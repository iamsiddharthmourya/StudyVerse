import assert from 'node:assert/strict';
import {
  createQuiz,
  deleteAttempt,
  deleteQuiz,
  getAttempt,
  getQuiz,
  listAttempts,
  listQuizzes,
  saveAttempt,
} from '../src/quizverse/services/quizStorage.js';
import { SAMPLE_QUIZZES } from '../src/quizverse/utils/sampleQuizzes.js';
import { computeScore, formatQuizDuration } from '../src/quizverse/utils/quizHelpers.js';
import { validateAttempt, validateQuiz } from '../src/quizverse/services/quizValidation.js';

// Setup mock browser LocalStorage
const memory = new Map();
global.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear(),
};

async function runE2EJourney() {
  console.log('Running End-to-End QuizVerse User Flow Test in Guest Mode...\n');

  // Pre-seed StudyVerse guest data to verify it remains 100% untouched
  const initialStudyVerseData = JSON.stringify({
    tasks: [{ id: 't_preserve_1', title: 'Existing Study Task', completed: false }],
    settings: { theme: 'dark' },
  });
  localStorage.setItem('ssp:data:guest', initialStudyVerseData);
  localStorage.setItem('ssp:guest', '1');

  const guestUser = { uid: 'guest', mode: 'guest', name: 'Guest Student' };

  // Step 1: Initial state - no quizzes and no attempts
  let quizzes = await listQuizzes(guestUser);
  let attempts = await listAttempts(guestUser);
  assert.strictEqual(quizzes.length, 0, 'Quizzes should be empty initially');
  assert.strictEqual(attempts.length, 0, 'Attempts should be empty initially');
  console.log('  ok  Step 1: Initial state has 0 quizzes and 0 attempts');

  // Step 2: Create a Quiz (User clicks "Create Sample Quiz")
  const sampleTemplate = SAMPLE_QUIZZES[0];
  const newQuiz = await createQuiz(guestUser, {
    title: 'Biology Practice Quiz',
    sourceType: 'topic',
    sourceName: 'Biology',
    difficulty: 'medium',
    questions: sampleTemplate.questions,
  });

  assert.ok(newQuiz.id.startsWith('qz_'), 'Quiz ID must be generated with prefix');
  assert.strictEqual(newQuiz.title, 'Biology Practice Quiz');
  assert.strictEqual(newQuiz.questionCount, 5);

  quizzes = await listQuizzes(guestUser);
  assert.strictEqual(quizzes.length, 1, 'Should have 1 quiz in storage');
  assert.strictEqual(quizzes[0].id, newQuiz.id);
  console.log(`  ok  Step 2: Created quiz "${newQuiz.title}" (ID: ${newQuiz.id})`);

  // Step 3: Fetch Quiz for QuizPlay route
  const fetchedQuiz = await getQuiz(guestUser, newQuiz.id);
  assert.ok(fetchedQuiz, 'Quiz must be retrievable by ID');
  assert.strictEqual(fetchedQuiz.questions.length, 5);
  console.log('  ok  Step 3: Retrieved quiz for QuizPlay route');

  // Step 4: Simulate taking the quiz in QuizPlay and submitting
  // Let's answer 4 questions correctly, 1 incorrectly
  const userAnswers = {};
  fetchedQuiz.questions.forEach((q, idx) => {
    if (idx < 4) {
      userAnswers[q.id] = q.correctIndex; // Correct answer
    } else {
      userAnswers[q.id] = (q.correctIndex + 1) % q.options.length; // Incorrect answer
    }
  });

  let correctCount = 0;
  let incorrectCount = 0;
  fetchedQuiz.questions.forEach((q) => {
    if (userAnswers[q.id] === q.correctIndex) {
      correctCount += 1;
    } else {
      incorrectCount += 1;
    }
  });

  const calculatedScore = computeScore(fetchedQuiz.questions.length, correctCount);
  assert.strictEqual(calculatedScore, 80, 'Score for 4/5 correct must be 80%');

  const attemptRecord = {
    quizId: newQuiz.id,
    quizTitle: newQuiz.title,
    totalQuestions: fetchedQuiz.questions.length,
    correctAnswers: correctCount,
    incorrectAnswers: incorrectCount,
    unanswered: 0,
    score: calculatedScore,
    startedAt: new Date(Date.now() - 95000).toISOString(),
    completedAt: new Date().toISOString(),
    timeTaken: 95,
    answers: userAnswers,
  };

  const savedAttempt = await saveAttempt(guestUser, attemptRecord);
  assert.ok(savedAttempt.id.startsWith('att_'), 'Attempt ID must have att_ prefix');
  assert.strictEqual(savedAttempt.score, 80);
  assert.strictEqual(savedAttempt.timeTaken, 95);
  console.log(`  ok  Step 4: Quiz completed and attempt saved (ID: ${savedAttempt.id}, Score: ${savedAttempt.score}%, Time: ${formatQuizDuration(savedAttempt.timeTaken)})`);

  // Step 5: Verify QuizResult route can load the attempt and corresponding quiz
  const fetchedAttempt = await getAttempt(guestUser, savedAttempt.id);
  assert.ok(fetchedAttempt, 'Attempt must be retrievable by ID');
  assert.strictEqual(fetchedAttempt.score, 80);
  const matchingQuiz = await getQuiz(guestUser, fetchedAttempt.quizId);
  assert.ok(matchingQuiz, 'Matching quiz for results review must exist');
  assert.strictEqual(matchingQuiz.id, newQuiz.id);
  console.log('  ok  Step 5: QuizResult loaded attempt and quiz explanations successfully');

  // Step 6: Verify Dashboard calculations with live data
  attempts = await listAttempts(guestUser);
  quizzes = await listQuizzes(guestUser);
  const totalQuizzes = quizzes.length;
  const totalAttempts = attempts.length;
  const averageScore = Math.round(attempts.reduce((acc, a) => acc + a.score, 0) / totalAttempts);
  const totalPracticeTime = attempts.reduce((acc, a) => acc + a.timeTaken, 0);

  assert.strictEqual(totalQuizzes, 1);
  assert.strictEqual(totalAttempts, 1);
  assert.strictEqual(averageScore, 80);
  assert.strictEqual(totalPracticeTime, 95);
  assert.strictEqual(formatQuizDuration(totalPracticeTime), '1m 35s');
  console.log(`  ok  Step 6: Dashboard stats dynamically updated (Quizzes: ${totalQuizzes}, Attempts: ${totalAttempts}, Avg: ${averageScore}%, Time: ${formatQuizDuration(totalPracticeTime)})`);

  // Step 7: Delete Attempt and Quiz
  const deleteAttemptRes = await deleteAttempt(guestUser, savedAttempt.id);
  assert.strictEqual(deleteAttemptRes, true);
  attempts = await listAttempts(guestUser);
  assert.strictEqual(attempts.length, 0, 'Attempts should be 0 after deletion');

  const deleteQuizRes = await deleteQuiz(guestUser, newQuiz.id);
  assert.strictEqual(deleteQuizRes, true);
  quizzes = await listQuizzes(guestUser);
  assert.strictEqual(quizzes.length, 0, 'Quizzes should be 0 after deletion');
  console.log('  ok  Step 7: Clean deletion of attempts and quizzes verified');

  // Step 8: Verify StudyVerse storage is completely untouched
  const finalStudyVerseData = localStorage.getItem('ssp:data:guest');
  assert.strictEqual(
    finalStudyVerseData,
    initialStudyVerseData,
    'StudyVerse guest data must not be touched or corrupted by QuizVerse operations',
  );
  console.log('  ok  Step 8: StudyVerse data (ssp:data:guest) strictly segregated and 100% preserved');

  console.log('\nAll End-to-End QuizVerse User Flow Scenarios Passed Successfully!');
}

runE2EJourney().catch((err) => {
  console.error('E2E Flow test failed:', err);
  process.exit(1);
});
