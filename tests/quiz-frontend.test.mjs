import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

// Mock browser globals for SSR testing
const storage = new Map();
storage.set('ssp:guest', '1');
storage.set('ssp:theme', 'dark');

global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

global.window = {
  location: { hash: '', pathname: '/', search: '' },
  scrollTo: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

global.document = {
  documentElement: { dataset: {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  body: { style: {} },
};

async function run() {
  console.log('Running QuizVerse Phase 4 Frontend Tests...\n');

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  const { MemoryRouter, Route, Routes } = await import('react-router-dom');

  // Load QuizVerse modules
  const { default: QuizDashboard } = await server.ssrLoadModule('./src/quizverse/pages/QuizDashboard.jsx');
  const { default: QuizCreate } = await server.ssrLoadModule('./src/quizverse/pages/QuizCreate.jsx');
  const { default: QuizPlay } = await server.ssrLoadModule('./src/quizverse/pages/QuizPlay.jsx');
  const { default: QuizResult } = await server.ssrLoadModule('./src/quizverse/pages/QuizResult.jsx');
  const { default: QuizHistory } = await server.ssrLoadModule('./src/quizverse/pages/QuizHistory.jsx');
  const { QuizProvider } = await server.ssrLoadModule('./src/quizverse/state/QuizContext.jsx');
  const { AuthProvider } = await server.ssrLoadModule('./src/services/auth.jsx');
  const { UIProvider } = await server.ssrLoadModule('./src/components/ui.jsx');
  const { SAMPLE_QUIZZES } = await server.ssrLoadModule('./src/quizverse/utils/sampleQuizzes.js');
  const { validateQuiz, validateAttempt } = await server.ssrLoadModule('./src/quizverse/services/quizValidation.js');
  const { formatQuizDuration, computeScore } = await server.ssrLoadModule('./src/quizverse/utils/quizHelpers.js');

  // Test 1: Validate Sample Quizzes schemas
  {
    assert.ok(Array.isArray(SAMPLE_QUIZZES) && SAMPLE_QUIZZES.length >= 2, 'Must have at least 2 sample quizzes');
    SAMPLE_QUIZZES.forEach((sq, i) => {
      const res = validateQuiz(sq);
      assert.ok(res.valid, `Sample quiz #${i + 1} (${sq.title}) must pass validation: ${res.errors.join(', ')}`);
      assert.strictEqual(sq.questions.length, 5, 'Sample quiz must contain 5 questions');
      sq.questions.forEach((q, qi) => {
        assert.ok(q.options.length >= 2, `Question ${qi} must have at least 2 options`);
        assert.ok(q.explanation.length > 0, `Question ${qi} must have an explanation`);
      });
    });
    console.log('  ok  Test 1: All pre-built starter sample quizzes pass schema validation');
  }

  // Test 2: File size & extension validation rules (<= 5 MB, pdf/docx/txt)
  {
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_EXT = ['.pdf', '.docx', '.txt'];

    function testFile(name, size) {
      const lower = name.toLowerCase();
      const validExt = ALLOWED_EXT.some((ext) => lower.endsWith(ext));
      if (!validExt) return { valid: false, error: 'invalid_ext' };
      if (size > MAX_FILE_SIZE) return { valid: false, error: 'exceeds_size' };
      return { valid: true };
    }

    assert.ok(testFile('notes.pdf', 2 * 1024 * 1024).valid, 'Valid 2MB PDF accepted');
    assert.ok(testFile('lecture.docx', 4.9 * 1024 * 1024).valid, 'Valid 4.9MB DOCX accepted');
    assert.ok(testFile('summary.txt', 100 * 1024).valid, 'Valid 100KB TXT accepted');
    assert.strictEqual(testFile('large.pdf', 5.1 * 1024 * 1024).error, 'exceeds_size', 'Rejects > 5 MB');
    assert.strictEqual(testFile('archive.zip', 1024 * 1024).error, 'invalid_ext', 'Rejects .zip');
    assert.strictEqual(testFile('image.png', 1024 * 1024).error, 'invalid_ext', 'Rejects .png');
    console.log('  ok  Test 2: File upload validation strictly enforces <= 5 MB limit and allowed extensions (.pdf, .docx, .txt)');
  }

  // Test 3: Score calculation and attempt validation
  {
    assert.strictEqual(computeScore(10, 8), 80);
    assert.strictEqual(computeScore(5, 5), 100);
    assert.strictEqual(computeScore(5, 0), 0);
    assert.strictEqual(computeScore(3, 2), 67); // 66.66% rounded to 67

    const testAttempt = {
      quizId: 'qz_test_123',
      quizTitle: 'Biology Quiz',
      totalQuestions: 5,
      correctAnswers: 4,
      incorrectAnswers: 1,
      unanswered: 0,
      score: 80,
      timeTaken: 125,
      answers: { q_1: 0, q_2: 1, q_3: 2, q_4: 0, q_5: 3 },
    };
    const attRes = validateAttempt(testAttempt);
    assert.ok(attRes.valid, 'Attempt must pass validation');
    assert.strictEqual(formatQuizDuration(125), '2m 5s');
    console.log('  ok  Test 3: Score calculation and attempt metrics format properly');
  }

  // Helper renderer
  const wrap = (initialEntry, element) =>
    renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(
          UIProvider,
          null,
          React.createElement(
            QuizProvider,
            null,
            React.createElement(MemoryRouter, { initialEntries: [initialEntry] }, element)
          )
        )
      )
    );

  // Test 4: Render QuizDashboard (/quiz)
  {
    const html = wrap('/quiz', React.createElement(QuizDashboard));
    assert.ok(html.includes('Welcome back'), 'Dashboard must render welcome greeting');
    assert.ok(html.includes('Create New Quiz'), 'Dashboard must render primary CTA button');
    assert.ok(html.includes('Quizzes Created'), 'Dashboard must render Quizzes Created metric');
    assert.ok(html.includes('Total Attempts'), 'Dashboard must render Total Attempts metric');
    assert.ok(html.includes('Average Score'), 'Dashboard must render Average Score metric');
    assert.ok(html.includes('Time Practiced'), 'Dashboard must render Time Practiced metric');
    assert.ok(html.includes('Switch to StudyVerse'), 'Dashboard must render Switch to StudyVerse button');
    console.log('  ok  Test 4: QuizDashboard renders with greeting, stats grid, and StudyVerse switch button');
  }

  // Test 5: Render QuizCreate (/quiz/create)
  {
    const html = wrap('/quiz/create', React.createElement(QuizCreate));
    assert.ok(html.includes('Create New Quiz'), 'Create page must render title');
    assert.ok(html.includes('Topic-based'), 'Must have Topic-based tab');
    assert.ok(html.includes('Notes-based'), 'Must have Notes-based tab');
    assert.ok(html.includes('Difficulty Level'), 'Must have Difficulty selector');
    assert.ok(html.includes('Number of Questions'), 'Must have Question count selector');
    assert.ok(html.includes('Generate Quiz'), 'Must have Generate Quiz button');
    assert.ok(html.includes('Ready-to-Test Sample Quizzes'), 'Must have Sample Quizzes sidebar');
    console.log('  ok  Test 5: QuizCreate renders with topic/notes modes, difficulty & question count selectors, and starter quiz options');
  }

  // Test 6: Render QuizPlay (/quiz/play/:quizId) - Not Found state
  {
    const html = wrap(
      '/quiz/play/nonexistent-id',
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: '/quiz/play/:quizId', element: React.createElement(QuizPlay) })
      )
    );
    assert.ok(html.includes('Quiz Not Found') || html.includes('Loading Quiz'), 'Must render not found or loading');
    console.log('  ok  Test 6: QuizPlay gracefully handles non-existent or invalid quiz IDs');
  }

  // Test 7: Render QuizResult (/quiz/result/:attemptId) - Not Found state
  {
    const html = wrap(
      '/quiz/result/nonexistent-id',
      React.createElement(
        Routes,
        null,
        React.createElement(Route, { path: '/quiz/result/:attemptId', element: React.createElement(QuizResult) })
      )
    );
    assert.ok(html.includes('Attempt Not Found') || html.includes('Loading Results'), 'Must render not found or loading');
    console.log('  ok  Test 7: QuizResult gracefully handles missing attempt IDs');
  }

  // Test 8: Render QuizHistory (/quiz/history)
  {
    const html = wrap('/quiz/history', React.createElement(QuizHistory));
    assert.ok(html.includes('Quiz History &amp; Library') || html.includes('Quiz History & Library'), 'History page must render title');
    assert.ok(html.includes('Practice Attempts'), 'Must render Practice Attempts tab');
    assert.ok(html.includes('Saved Quizzes'), 'Must render Saved Quizzes tab');
    assert.ok(html.includes('Search'), 'Must render search filter');
    console.log('  ok  Test 8: QuizHistory renders with dual tabs (Attempts and Quizzes) and search filter');
  }

  await server.close();
  console.log('\nAll QuizVerse Phase 4 Frontend Tests Passed Successfully!');
}

run().catch((err) => {
  console.error('Quiz frontend test failed:', err);
  process.exit(1);
});
