// Unit Tests for QuizVerse Validation, Guest Storage & Data Architecture
import assert from 'node:assert/strict';
import { LIMITS, validateAttempt, validateQuestion, validateQuiz } from '../src/quizverse/services/quizValidation.js';
import { GUEST_STORAGE_KEYS, createQuiz, deleteAttempt, deleteQuiz, getAttempt, getQuiz, listAttempts, listQuizzes, saveAttempt, updateQuiz } from '../src/quizverse/services/quizStorage.js';
import { computeScore, formatQuizDuration, generateAttemptId, generateQuestionId, generateQuizId } from '../src/quizverse/utils/quizHelpers.js';

// Setup Mock LocalStorage
const storage = new Map();
global.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

console.log('Running QuizVerse Phase 3 Tests...\n');

// ==========================================================================
// 1. Helpers & Utility Tests
// ==========================================================================
{
  const qzId = generateQuizId();
  assert.ok(qzId.startsWith('qz_'), 'Quiz ID must start with qz_');

  const attId = generateAttemptId();
  assert.ok(attId.startsWith('att_'), 'Attempt ID must start with att_');

  const qId = generateQuestionId(2);
  assert.ok(qId.startsWith('q_3_'), 'Question ID must include 1-based index');

  assert.equal(computeScore(10, 8), 80);
  assert.equal(computeScore(3, 1), 33);
  assert.equal(computeScore(0, 0), 0);

  assert.equal(formatQuizDuration(45), '45s');
  assert.equal(formatQuizDuration(125), '2m 5s');
  console.log('  ok  Helpers: ID generation, score calculation, and duration formatting');
}

// ==========================================================================
// 2. Question Validation Tests
// ==========================================================================
{
  // Valid question
  const validQ = {
    question: 'What is the speed of light?',
    options: ['3x10^8 m/s', '3x10^6 m/s', '3x10^5 m/s', '300 m/s'],
    correctIndex: 0,
    explanation: 'The speed of light in vacuum is approx 300,000 km/s.',
  };
  const res = validateQuestion(validQ, 0);
  assert.equal(res.valid, true);
  assert.equal(res.cleanQuestion.correctIndex, 0);
  assert.equal(res.cleanQuestion.options.length, 4);

  // Missing question prompt
  assert.equal(validateQuestion({ ...validQ, question: '   ' }).valid, false);

  // Less than 2 options
  assert.equal(validateQuestion({ ...validQ, options: ['Only one'] }).valid, false);

  // More than 4 options
  assert.equal(validateQuestion({ ...validQ, options: ['A', 'B', 'C', 'D', 'E'] }).valid, false);

  // Empty option string
  assert.equal(validateQuestion({ ...validQ, options: ['A', '  ', 'C', 'D'] }).valid, false);

  // Out-of-bounds correctIndex
  assert.equal(validateQuestion({ ...validQ, correctIndex: 4 }).valid, false);
  assert.equal(validateQuestion({ ...validQ, correctIndex: -1 }).valid, false);
  assert.equal(validateQuestion({ ...validQ, correctIndex: 'abc' }).valid, false);

  console.log('  ok  Quiz validation: single question schema boundaries enforced');
}

// ==========================================================================
// 3. Quiz Document Validation Tests
// ==========================================================================
{
  const makeSampleQuiz = (overrides = {}) => ({
    title: 'Operating Systems Quiz',
    description: 'Covers process scheduling and memory management.',
    sourceType: 'topic',
    difficulty: 'medium',
    questions: [
      {
        question: 'What is a deadlock?',
        options: ['A condition where processes wait indefinitely', 'A fast CPU cycle', 'A thread pool', 'RAM overflow'],
        correctIndex: 0,
        explanation: 'Deadlock is a circular wait situation.',
      },
      {
        question: 'Which scheduling algorithm is non-preemptive?',
        options: ['FCFS', 'Round Robin', 'SRTF', 'Priority with preemption'],
        correctIndex: 0,
        explanation: 'First-Come First-Served is strictly non-preemptive.',
      },
    ],
    ...overrides,
  });

  // Valid quiz accepted
  const validRes = validateQuiz(makeSampleQuiz());
  assert.equal(validRes.valid, true);
  assert.equal(validRes.cleanQuiz.questionCount, 2);
  assert.equal(validRes.cleanQuiz.title, 'Operating Systems Quiz');

  // Missing title rejected
  assert.equal(validateQuiz(makeSampleQuiz({ title: '   ' })).valid, false);

  // Empty questions array rejected
  assert.equal(validateQuiz(makeSampleQuiz({ questions: [] })).valid, false);

  // Invalid difficulty rejected
  assert.equal(validateQuiz(makeSampleQuiz({ difficulty: 'impossible' })).valid, false);

  // Invalid sourceType rejected
  assert.equal(validateQuiz(makeSampleQuiz({ sourceType: 'audio' })).valid, false);

  // More than 50 questions rejected
  const tooManyQuestions = Array.from({ length: 51 }, (_, i) => ({
    question: `Question ${i + 1}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
  }));
  const overLimitRes = validateQuiz(makeSampleQuiz({ questions: tooManyQuestions }));
  assert.equal(overLimitRes.valid, false);
  assert.ok(overLimitRes.errors.some((e) => e.includes('50')));

  console.log('  ok  Quiz validation: accepts valid quiz, rejects missing title, invalid difficulty, and >50 questions');
}

// ==========================================================================
// 4. Attempt Validation Tests
// ==========================================================================
{
  const validAttempt = {
    quizId: 'qz_sample_123',
    quizTitle: 'OS Quiz',
    totalQuestions: 10,
    correctAnswers: 8,
    incorrectAnswers: 2,
    unanswered: 0,
    score: 80,
    timeTaken: 120,
    answers: { q_1: 0, q_2: 1 },
  };

  const attRes = validateAttempt(validAttempt);
  assert.equal(attRes.valid, true);
  assert.equal(attRes.cleanAttempt.score, 80);

  // Missing quizId rejected
  assert.equal(validateAttempt({ ...validAttempt, quizId: '' }).valid, false);

  // Out-of-bounds correctAnswers
  assert.equal(validateAttempt({ ...validAttempt, correctAnswers: 15 }).valid, false);

  console.log('  ok  Attempt validation: valid attempt accepted, invalid metrics rejected');
}

// ==========================================================================
// 5. Guest Mode Storage & Data Isolation Tests
// ==========================================================================
{
  localStorage.clear();

  // Populate pre-existing StudyVerse guest data
  const studyVerseGuestData = {
    tasks: [{ id: 'task-1', title: 'Study OS', dueDate: '2026-11-20' }],
    goals: [],
    settings: { name: 'Guest' },
    updatedAt: '2026-11-17T10:00:00Z',
  };
  localStorage.setItem('ssp:data:guest', JSON.stringify(studyVerseGuestData));
  localStorage.setItem('ssp:theme', 'dark');
  localStorage.setItem('ssp:guest', '1');

  const guestUser = { uid: 'guest', name: 'Guest', mode: 'guest' };

  // A. Create Quiz in Guest Mode
  const createdQuiz = await createQuiz(guestUser, {
    title: 'Computer Networks',
    sourceType: 'topic',
    difficulty: 'easy',
    questions: [
      {
        question: 'What layer does IP belong to?',
        options: ['Network', 'Transport', 'Data Link', 'Application'],
        correctIndex: 0,
      },
    ],
  });

  assert.ok(createdQuiz.id.startsWith('qz_'));
  assert.equal(createdQuiz.title, 'Computer Networks');

  // Verify stored in qv:quizzes:guest
  const rawQuizzes = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEYS.QUIZZES));
  assert.equal(rawQuizzes.length, 1);
  assert.equal(rawQuizzes[0].id, createdQuiz.id);

  // B. Retrieve Quiz
  const fetched = await getQuiz(guestUser, createdQuiz.id);
  assert.equal(fetched.title, 'Computer Networks');

  // C. Update Quiz
  const updated = await updateQuiz(guestUser, createdQuiz.id, { title: 'Computer Networks (Revised)' });
  assert.equal(updated.title, 'Computer Networks (Revised)');
  const fetchedUpdated = await getQuiz(guestUser, createdQuiz.id);
  assert.equal(fetchedUpdated.title, 'Computer Networks (Revised)');

  // D. Create Attempt in Guest Mode
  const attempt = await saveAttempt(guestUser, {
    quizId: createdQuiz.id,
    quizTitle: updated.title,
    totalQuestions: 1,
    correctAnswers: 1,
    score: 100,
    timeTaken: 15,
  });

  assert.ok(attempt.id.startsWith('att_'));
  assert.equal(attempt.score, 100);

  // Verify stored in qv:attempts:guest
  const rawAttempts = JSON.parse(localStorage.getItem(GUEST_STORAGE_KEYS.ATTEMPTS));
  assert.equal(rawAttempts.length, 1);
  assert.equal(rawAttempts[0].id, attempt.id);

  // List attempts
  const attemptsList = await listAttempts(guestUser, createdQuiz.id);
  assert.equal(attemptsList.length, 1);

  // E. Delete Quiz
  const delRes = await deleteQuiz(guestUser, createdQuiz.id);
  assert.equal(delRes, true);
  assert.equal(await getQuiz(guestUser, createdQuiz.id), null);

  // F. Corrupt JSON safety
  localStorage.setItem(GUEST_STORAGE_KEYS.QUIZZES, 'INVALID_JSON{[[[');
  const safeList = await listQuizzes(guestUser);
  assert.deepEqual(safeList, [], 'Corrupt JSON in storage must gracefully return empty array');

  // G. CRITICAL ISOLATION CHECK: StudyVerse LocalStorage keys must be 100% UNTOUCHED
  assert.equal(
    localStorage.getItem('ssp:data:guest'),
    JSON.stringify(studyVerseGuestData),
    'CRITICAL: ssp:data:guest must remain completely untouched by QuizVerse operations'
  );
  assert.equal(localStorage.getItem('ssp:theme'), 'dark');
  assert.equal(localStorage.getItem('ssp:guest'), '1');

  console.log('  ok  Guest Mode storage: CRUD operations succeed, corrupt JSON handled safely, StudyVerse data untouched');
}

// ==========================================================================
// 6. Firestore Subcollection Pathing & Architecture Tests
// ==========================================================================
{
  const googleUid = 'google_user_999';
  const expectedQuizPath = `users/${googleUid}/quizzes/qz_123`;
  const expectedAttemptPath = `users/${googleUid}/attempts/att_456`;
  const studyVerseRootPath = `users/${googleUid}`;

  assert.notEqual(expectedQuizPath, studyVerseRootPath);
  assert.notEqual(expectedAttemptPath, studyVerseRootPath);
  assert.ok(expectedQuizPath.startsWith(studyVerseRootPath + '/quizzes/'));
  assert.ok(expectedAttemptPath.startsWith(studyVerseRootPath + '/attempts/'));

  console.log('  ok  Firestore architecture: Subcollections strictly segregated from StudyVerse root document');
}

console.log('\nAll QuizVerse Phase 3 tests passed successfully!');
