import assert from 'node:assert/strict';
import {
  checkQuota,
  commitQuota,
  getIstDateKey,
  getNextMidnightIst,
  reserveQuota,
  rollbackQuota,
  _resetStoreForTesting,
  DAILY_LIMIT,
} from '../api/_lib/quota.js';
import { createGuestToken, verifyGuestToken } from '../api/_lib/auth.js';
import {
  detectFormat,
  extractTextFromBuffer,
  MAX_FILE_SIZE_BYTES,
  MIN_TEXT_LENGTH,
} from '../api/_lib/extractor.js';
import {
  generateQuizWithGemini,
  discoverSupportedModels,
  resolveModelPlan,
  isTextGenerationModel,
  _resetModelCacheForTesting,
} from '../api/_lib/gemini.js';
import { validateQuiz } from '../src/quizverse/services/quizValidation.js';

// Minimal valid PDF with >50 chars of text
const VALID_SAMPLE_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 150 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Photosynthesis is the biological process by which green plants transform light energy into chemical energy in chloroplasts.) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000227 00000 n \n0000000305 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n508\n%%EOF\n'
);

// Valid sample TXT with >50 chars
const VALID_SAMPLE_TXT = Buffer.from(
  'Cellular respiration is a series of chemical reactions that break down glucose to produce ATP, which can be used as energy to power many reactions throughout the cell.',
  'utf8'
);

async function run() {
  console.log('Running Phase 5 Gemini Backend & Quota Enforcement Tests...\n');

  // =========================================================================
  // Test A: Midnight IST Calculation & Date Key
  // =========================================================================
  {
    const now = new Date();
    const dateKey = getIstDateKey(now);
    assert.match(dateKey, /^\d{4}-\d{2}-\d{2}$/, 'Date key must be YYYY-MM-DD');

    const nextMidnight = getNextMidnightIst(now);
    assert.ok(nextMidnight.remainingSeconds > 0, 'Must have remaining seconds until midnight');
    assert.ok(nextMidnight.remainingSeconds <= 86400, 'Remaining seconds cannot exceed 24 hours');
    assert.ok(new Date(nextMidnight.iso) > now, 'Next midnight must be in the future');

    // Simulate rollover test: 23:59:59 IST vs 00:00:00 IST
    // 2026-11-17 18:29:59 UTC = 2026-11-17 23:59:59 IST
    const beforeMidnight = new Date(Date.UTC(2026, 10, 17, 18, 29, 59));
    const afterMidnight = new Date(Date.UTC(2026, 10, 17, 18, 30, 1));
    assert.strictEqual(getIstDateKey(beforeMidnight), '2026-11-17');
    assert.strictEqual(getIstDateKey(afterMidnight), '2026-11-18');
    console.log('  ok  Test 1: Midnight IST calculation and automatic date rollover verified');
  }

  // =========================================================================
  // Test B: Quota Manager - 5 Daily Limit & 6th Blocked
  // =========================================================================
  {
    _resetStoreForTesting();
    const testUser = 'user_quota_test_1';
    const dateKey = '2026-11-17';

    // Check initial state
    let status = checkQuota(testUser, dateKey);
    assert.strictEqual(status.limit, 5);
    assert.strictEqual(status.remaining, 5);
    assert.strictEqual(status.used, 0);

    // Reserve and commit 5 slots
    const reservationIds = [];
    for (let i = 0; i < 5; i++) {
      const res = reserveQuota(testUser, dateKey);
      assert.ok(res.allowed, `Slot ${i + 1} must be reserved`);
      reservationIds.push(res.reservationId);
      commitQuota(testUser, dateKey, res.reservationId);
    }

    // Check usage is now 5
    status = checkQuota(testUser, dateKey);
    assert.strictEqual(status.used, 5);
    assert.strictEqual(status.remaining, 0);
    assert.strictEqual(status.allowed, false);

    // 6th Attempt: must be blocked with DAILY_QUOTA_EXCEEDED
    const blockedRes = reserveQuota(testUser, dateKey);
    assert.strictEqual(blockedRes.allowed, false);
    assert.strictEqual(blockedRes.error, 'DAILY_QUOTA_EXCEEDED');
    assert.strictEqual(blockedRes.remaining, 0);
    console.log('  ok  Test 2: Daily limit of 5 enforced; 6th generation strictly blocked');
  }

  // =========================================================================
  // Test C: Failed Generation Does NOT Consume Quota (Rollback)
  // =========================================================================
  {
    _resetStoreForTesting();
    const testUser = 'user_rollback_test';
    const dateKey = '2026-11-17';

    // Initial: 5 remaining
    assert.strictEqual(checkQuota(testUser, dateKey).remaining, 5);

    // Reserve 1 slot
    const res = reserveQuota(testUser, dateKey);
    assert.ok(res.allowed);

    // Simulate failure -> Rollback
    rollbackQuota(testUser, dateKey, res.reservationId);

    // Quota must remain completely untouched (5 remaining, 0 used)
    const afterRollback = checkQuota(testUser, dateKey);
    assert.strictEqual(afterRollback.used, 0);
    assert.strictEqual(afterRollback.remaining, 5);
    console.log('  ok  Test 3: Failed generation rolls back slot; does not consume quota');
  }

  // =========================================================================
  // Test D: Midnight IST Reset
  // =========================================================================
  {
    const testUser = 'user_midnight_test';
    const day1Key = '2026-11-17';
    const day2Key = '2026-11-18';

    // Exhaust quota on Day 1
    for (let i = 0; i < 5; i++) {
      const res = reserveQuota(testUser, day1Key);
      commitQuota(testUser, day1Key, res.reservationId);
    }
    assert.strictEqual(checkQuota(testUser, day1Key).remaining, 0);

    // On Day 2 (after midnight IST), quota is fresh again (5 remaining)
    const day2Status = checkQuota(testUser, day2Key);
    assert.strictEqual(day2Status.remaining, 5);
    assert.strictEqual(day2Status.used, 0);
    assert.strictEqual(day2Status.allowed, true);
    console.log('  ok  Test 4: Midnight IST reset restores fresh 5 generations on new date key');
  }

  // =========================================================================
  // Test E: Atomic Concurrency Enforcement
  // =========================================================================
  {
    _resetStoreForTesting();
    const testUser = 'user_concurrency_test';
    const dateKey = '2026-11-17';

    // Fire 12 simultaneous reservation attempts at once
    const attempts = await Promise.all(
      Array.from({ length: 12 }).map(async () => reserveQuota(testUser, dateKey))
    );

    const successfulReservations = attempts.filter((r) => r.allowed);
    const blockedReservations = attempts.filter((r) => !r.allowed);

    assert.strictEqual(successfulReservations.length, 5, 'Exactly 5 concurrent requests must succeed');
    assert.strictEqual(blockedReservations.length, 7, 'Remaining 7 requests must be blocked');

    // Clean up
    successfulReservations.forEach((r) => rollbackQuota(testUser, dateKey, r.reservationId));
    console.log('  ok  Test 5: Concurrent requests handled atomically without race condition');
  }

  // =========================================================================
  // Test F: Guest Mode Cryptographic HMAC Session
  // =========================================================================
  {
    // Create guest token
    const token = createGuestToken('gst_test_999');
    assert.ok(typeof token === 'string' && token.includes('.'));

    // Verify valid token
    const verified = verifyGuestToken(token);
    assert.ok(verified, 'Valid guest token must verify');
    assert.strictEqual(verified.guestId, 'gst_test_999');

    // Tampered token test (modified payload)
    const [payloadStr, sig] = token.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ guestId: 'gst_hacked' })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${sig}`;
    assert.strictEqual(verifyGuestToken(tamperedToken), null, 'Tampered token must be rejected');

    // Unsigned / plain client UID rejected
    assert.strictEqual(verifyGuestToken('plain_guest_uid'), null, 'Plain unverified UID rejected');
    console.log('  ok  Test 6: Guest Mode cryptographically verified via HMAC signature; tampering rejected');
  }

  // =========================================================================
  // Test G: Text Extraction - PDF, DOCX, TXT, and Format Detection
  // =========================================================================
  {
    // Format detection
    assert.strictEqual(detectFormat(VALID_SAMPLE_PDF, 'notes.pdf'), 'pdf');
    assert.strictEqual(detectFormat(VALID_SAMPLE_TXT, 'notes.txt'), 'txt');

    // PDF extraction
    const pdfText = await extractTextFromBuffer(VALID_SAMPLE_PDF, 'notes.pdf');
    assert.ok(pdfText.includes('Photosynthesis'), 'PDF text must contain expected keywords');
    assert.ok(pdfText.length >= MIN_TEXT_LENGTH, 'Extracted text must meet minimum length');

    // DOCX extraction
    const fs = await import('node:fs');
    if (fs.existsSync('node_modules/mammoth/test/test-data/tables.docx')) {
      const docxBuf = fs.readFileSync('node_modules/mammoth/test/test-data/tables.docx');
      assert.strictEqual(detectFormat(docxBuf, 'tables.docx'), 'docx');
      const docxText = await extractTextFromBuffer(docxBuf, 'tables.docx');
      assert.ok(docxText.length >= MIN_TEXT_LENGTH, 'DOCX text must meet minimum length');
    }

    // TXT extraction
    const txtText = await extractTextFromBuffer(VALID_SAMPLE_TXT, 'notes.txt');
    assert.ok(txtText.includes('Cellular respiration'), 'TXT text must contain expected keywords');
    assert.ok(txtText.length >= MIN_TEXT_LENGTH);
    console.log('  ok  Test 7: Document extraction succeeded for PDF, DOCX, and TXT documents');
  }

  // =========================================================================
  // Test H: Invalid and Corrupted Documents
  // =========================================================================
  {
    // File > 5 MB
    const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024, 0x41);
    await assert.rejects(
      async () => extractTextFromBuffer(oversizedBuffer, 'huge.txt'),
      /exceeds maximum allowed limit of 5 MB/i,
      'Must reject files > 5 MB'
    );

    // Empty buffer
    await assert.rejects(
      async () => extractTextFromBuffer(Buffer.alloc(0), 'empty.txt'),
      /empty file received/i
    );

    // Content < 50 characters
    const shortBuffer = Buffer.from('Too short', 'utf8');
    await assert.rejects(
      async () => extractTextFromBuffer(shortBuffer, 'short.txt'),
      /sufficient readable text/i
    );

    // Corrupted PDF (bad header)
    const corruptedPdf = Buffer.from('NOT_A_PDF_DATA_HERE_1234567890_XYZ', 'utf8');
    await assert.rejects(
      async () => extractTextFromBuffer(corruptedPdf, 'corrupted.pdf'),
      /unsupported file format/i
    );
    console.log('  ok  Test 8: Corrupted, empty, short (<50 chars), and oversized (>5MB) files rejected');
  }

  // =========================================================================
  // Test I: Gemini Response Parsing & Schema Validation
  // =========================================================================
  {
    // Simulated valid Gemini JSON output
    const mockGeminiOutput = {
      title: 'Cellular Respiration Test',
      description: 'Practice questions on glycolysis and ATP synthesis.',
      questions: [
        {
          question: 'What is the net ATP yield of glycolysis?',
          options: ['2 ATP', '4 ATP', '32 ATP', '36 ATP'],
          correctIndex: 0,
          explanation: 'Glycolysis yields a net of 2 ATP per glucose molecule.',
        },
        {
          question: 'Where does the Krebs cycle take place?',
          options: ['Mitochondrial Matrix', 'Cytosol', 'Thylakoid', 'Outer Membrane'],
          correctIndex: 0,
          explanation: 'The citric acid cycle operates within the mitochondrial matrix.',
        },
      ],
    };

    const validCandidate = {
      title: mockGeminiOutput.title,
      description: mockGeminiOutput.description,
      sourceType: 'topic',
      sourceName: 'Biology',
      difficulty: 'medium',
      questionCount: mockGeminiOutput.questions.length,
      questions: mockGeminiOutput.questions.map((q, idx) => ({
        id: `q_${idx + 1}`,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      })),
    };

    const validation = validateQuiz(validCandidate);
    assert.ok(validation.valid, 'Valid Gemini-synthesized quiz must pass schema validation');
    assert.strictEqual(validation.cleanQuiz.questions.length, 2);
    assert.strictEqual(validation.cleanQuiz.questions[0].options.length, 4);
    assert.strictEqual(validation.cleanQuiz.questions[0].correctIndex, 0);

    // Test malformed questions rejected
    const malformedQuiz = {
      ...validCandidate,
      questions: [{ question: '', options: ['A'], correctIndex: 5 }],
      questionCount: 1,
    };
    const invalidRes = validateQuiz(malformedQuiz);
    assert.strictEqual(invalidRes.valid, false, 'Malformed question must be rejected');
    console.log('  ok  Test 9: Gemini response normalization and strict schema validation enforced');
  }

  // =========================================================================
  // Test J: Missing Server Key Handling
  // =========================================================================
  {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    await assert.rejects(
      async () => generateQuizWithGemini({ sourceType: 'topic', topic: 'Chemistry' }),
      /GEMINI_API_KEY is not configured/i,
      'Must cleanly inform user when server key is not configured'
    );

    if (origKey) process.env.GEMINI_API_KEY = origKey;
    console.log('  ok  Test 10: Server key absence handled gracefully with clear configuration advice');
  }

  // =========================================================================
  // Test K: isTextGenerationModel Helper Verification
  // =========================================================================
  {
    // Text models must be accepted
    assert.strictEqual(isTextGenerationModel('gemini-2.0-flash'), true);
    assert.strictEqual(isTextGenerationModel('gemini-2.0-flash-lite'), true);
    assert.strictEqual(isTextGenerationModel('gemini-1.5-flash'), true);
    assert.strictEqual(isTextGenerationModel('gemini-1.5-pro'), true);

    // Image preview, image generation, audio, and embedding models must be strictly rejected
    assert.strictEqual(isTextGenerationModel('gemini-2.5-flash-preview-image'), false);
    assert.strictEqual(isTextGenerationModel('models/gemini-2.5-flash-preview-image'), false);
    assert.strictEqual(isTextGenerationModel('imagen-3.0-generate-002'), false);
    assert.strictEqual(isTextGenerationModel('gemini-image-preview'), false);
    assert.strictEqual(isTextGenerationModel('text-embedding-004'), false);
    assert.strictEqual(isTextGenerationModel('models/aqa'), false);
    assert.strictEqual(isTextGenerationModel('models/gemini-live-audio'), false);
    console.log('  ok  Test 11: isTextGenerationModel strictly filters out image preview and non-text models');
  }

  // =========================================================================
  // Test L: Dynamic models.list Discovery & Text Model Selection
  // =========================================================================
  {
    _resetModelCacheForTesting();
    const originalFetch = global.fetch;

    // Mock Google models.list endpoint containing a mix of text, image-preview, and embedding models
    global.fetch = async (url) => {
      if (url.includes('/models?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            models: [
              {
                name: 'models/embedding-001',
                displayName: 'Embedding Model',
                supportedGenerationMethods: ['embedContent'],
              },
              {
                name: 'models/gemini-2.5-flash-preview-image',
                displayName: 'Gemini 2.5 Flash Image Preview',
                supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
              },
              {
                name: 'models/imagen-3.0-generate-002',
                displayName: 'Imagen 3 Generative',
                supportedGenerationMethods: ['generateContent'],
              },
              {
                name: 'models/gemini-1.5-flash',
                displayName: 'Gemini 1.5 Flash',
                supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
              },
              {
                name: 'models/gemini-2.0-flash',
                displayName: 'Gemini 2.0 Flash',
                supportedGenerationMethods: ['generateContent', 'streamGenerateContent'],
              },
              {
                name: 'models/aqa',
                displayName: 'Attributed Question Answering',
                supportedGenerationMethods: ['generateAnswer'],
              },
            ],
          }),
        };
      }
      return originalFetch(url);
    };

    const discovered = await discoverSupportedModels('mock_api_key_test');
    assert.strictEqual(discovered.length, 2, 'Only text models supporting generateContent must be discovered');
    assert.ok(discovered.some((m) => m.id === 'gemini-2.0-flash'));
    assert.ok(discovered.some((m) => m.id === 'gemini-1.5-flash'));
    assert.ok(!discovered.some((m) => m.id.includes('preview-image')), 'gemini-2.5-flash-preview-image must be excluded');
    assert.ok(!discovered.some((m) => m.id.includes('imagen')), 'Imagen models must be excluded');
    assert.ok(!discovered.some((m) => m.id === 'embedding-001'), 'Embedding models must be excluded');

    // Test selection ranking: gemini-2.0-flash ranked above gemini-1.5-flash
    const plan = await resolveModelPlan('mock_api_key_test', null);
    assert.strictEqual(plan[0].model, 'gemini-2.0-flash');
    assert.strictEqual(plan[0].source, 'discovered_primary');

    // Test user-configured image model override rejected in favor of verified text model
    const planWithImageOverride = await resolveModelPlan('mock_api_key_test', 'gemini-2.5-flash-preview-image');
    assert.strictEqual(planWithImageOverride[0].model, 'gemini-2.0-flash', 'Must ignore image model override and use text model');

    // Test outdated/unsupported GEMINI_MODEL fallback:
    const planWithInvalidOverride = await resolveModelPlan('mock_api_key_test', 'deprecated-palm-2');
    assert.strictEqual(planWithInvalidOverride[0].model, 'gemini-2.0-flash', 'Must fall back to active discovered model');

    // Restore
    global.fetch = originalFetch;
    _resetModelCacheForTesting();
    console.log('  ok  Test 12: Dynamic models.list excludes image-preview models and selects text models');
  }

  // =========================================================================
  // Test M: HTTP 429 Rate Limit / Quota Handling (No Retry Loops)
  // =========================================================================
  {
    _resetModelCacheForTesting();
    const originalFetch = global.fetch;
    process.env.GEMINI_API_KEY = 'mock_key_for_429_test';

    let generateCallCount = 0;

    global.fetch = async (url) => {
      if (url.includes('/models?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            models: [
              {
                name: 'models/gemini-2.0-flash',
                supportedGenerationMethods: ['generateContent'],
              },
              {
                name: 'models/gemini-1.5-flash',
                supportedGenerationMethods: ['generateContent'],
              },
            ],
          }),
        };
      }

      if (url.includes(':generateContent')) {
        generateCallCount++;
        return {
          ok: false,
          status: 429,
          json: async () => ({
            error: {
              code: 429,
              message: 'Resource has been exhausted (e.g. check quota).',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
        };
      }

      return originalFetch(url);
    };

    try {
      await generateQuizWithGemini({
        sourceType: 'topic',
        topic: 'Rate Limit Test',
        questionCount: 5,
      });
      assert.fail('Must throw on HTTP 429');
    } catch (err) {
      assert.strictEqual(err.status, 429, 'Must preserve HTTP 429 status');
      assert.strictEqual(err.code, 'GEMINI_RATE_LIMIT');
      assert.match(err.message, /rate limit or quota/i);
      // Ensure Google's quota is respected: only 1 generateContent attempt made, no retry loops
      assert.strictEqual(generateCallCount, 1, 'Must NOT cycle through other models on HTTP 429');
    }

    // Restore
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
    _resetModelCacheForTesting();
    console.log('  ok  Test 13: HTTP 429 handled gracefully without bypassing Google quota');
  }

  console.log('\nAll 13 Phase 5 Gemini Backend & Quota Tests Passed Successfully!');
}

run().catch((err) => {
  console.error('Phase 5 test failed:', err);
  process.exit(1);
});
