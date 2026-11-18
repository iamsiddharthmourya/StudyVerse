// POST /api/generate-quiz
// Secure Vercel Serverless Function for AI Quiz Generation
// Enforces 5/day quota (reset at midnight IST), extracts documents, calls Gemini, and validates schema

import { authenticateRequest } from './_lib/auth.js';
import {
  reserveQuotaAsync,
  commitQuotaAsync,
  rollbackQuotaAsync,
  checkQuotaAsync,
} from './_lib/quota.js';
import { parseQuizRequest } from './_lib/extractor.js';
import { generateQuizWithGemini } from './_lib/gemini.js';

export const config = {
  api: {
    bodyParser: false, // Let extractor stream parse multipart/form-data with busboy
  },
};

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-Guest-Token, Content-Type, Accept');
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: `HTTP ${req.method} is not supported. Use POST /api/generate-quiz.`,
    });
  }

  let reservationId = null;
  let userId = null;

  try {
    // 1. Authenticate user (Firebase ID Token or HMAC-signed guest session)
    const auth = await authenticateRequest(req);
    userId = auth.userId;

    if (auth.guestToken) {
      res.setHeader('X-Guest-Token', auth.guestToken);
    }

    // 2. Atomically reserve quota slot (uses Vercel KV Lua script if configured; local container store otherwise)
    const quotaRes = await reserveQuotaAsync(userId);
    if (!quotaRes.allowed) {
      return res.status(429).json({
        error: 'DAILY_QUOTA_EXCEEDED',
        message: quotaRes.message || 'You have reached your daily limit of 5 AI quizzes.',
        limit: quotaRes.limit,
        used: quotaRes.used,
        remaining: 0,
        resetsAt: quotaRes.resetsAt,
        resetsInSeconds: quotaRes.resetsInSeconds,
        guestToken: auth.guestToken || undefined,
      });
    }

    reservationId = quotaRes.reservationId;

    // 3. Parse request payload and extract text if notes-based document
    let quizParams;
    try {
      quizParams = await parseQuizRequest(req);
    } catch (parseErr) {
      await rollbackQuotaAsync(userId, undefined, reservationId);
      reservationId = null;
      const currentQuota = await checkQuotaAsync(userId);
      return res.status(422).json({
        error: 'INVALID_REQUEST_PAYLOAD',
        message: parseErr.message,
        remaining: currentQuota.remaining,
        guestToken: auth.guestToken || undefined,
      });
    }

    // Validate minimum input
    if (quizParams.sourceType === 'topic' && !quizParams.topic) {
      await rollbackQuotaAsync(userId, undefined, reservationId);
      reservationId = null;
      const currentQuota = await checkQuotaAsync(userId);
      return res.status(400).json({
        error: 'MISSING_TOPIC',
        message: 'A quiz topic is required for topic-based quiz generation.',
        remaining: currentQuota.remaining,
        guestToken: auth.guestToken || undefined,
      });
    }

    if (quizParams.sourceType === 'document' && !quizParams.extractedText) {
      await rollbackQuotaAsync(userId, undefined, reservationId);
      reservationId = null;
      const currentQuota = await checkQuotaAsync(userId);
      return res.status(400).json({
        error: 'MISSING_DOCUMENT_TEXT',
        message: 'No readable text was found in the provided document.',
        remaining: currentQuota.remaining,
        guestToken: auth.guestToken || undefined,
      });
    }

    // 4. Call Google Gemini to synthesize questions
    let generatedQuiz;
    try {
      generatedQuiz = await generateQuizWithGemini(quizParams);
    } catch (geminiErr) {
      await rollbackQuotaAsync(userId, undefined, reservationId);
      reservationId = null;
      const currentQuota = await checkQuotaAsync(userId);

      const statusCode = geminiErr.status || 502;
      return res.status(statusCode).json({
        error: geminiErr.code || 'GEMINI_GENERATION_FAILED',
        message: geminiErr.message || 'Failed to generate quiz with Gemini AI.',
        diagnostics: geminiErr.diagnostics || null,
        remaining: currentQuota.remaining,
        guestToken: auth.guestToken || undefined,
      });
    }

    // 5. Success: Commit reserved quota permanently
    const committed = await commitQuotaAsync(userId, undefined, reservationId);
    reservationId = null; // Successfully committed

    return res.status(200).json({
      success: true,
      quiz: generatedQuiz,
      quota: {
        limit: committed.limit,
        used: committed.used,
        remaining: committed.remaining,
        resetsAt: committed.resetsAt,
      },
      guestToken: auth.guestToken || undefined,
    });
  } catch (err) {
    if (reservationId && userId) {
      try {
        await rollbackQuotaAsync(userId, undefined, reservationId);
      } catch {
        /* ignore */
      }
    }

    console.error('[API /generate-quiz] Unexpected server error:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred while processing your request.',
    });
  }
}
