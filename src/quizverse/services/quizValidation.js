// Schema validation and sanitization for QuizVerse Quizzes and Attempts
import { generateQuestionId } from '../utils/quizHelpers.js';

export const LIMITS = {
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 50,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 4,
  MAX_TITLE_LENGTH: 200,
  MAX_DESC_LENGTH: 2000,
  MAX_QUESTION_LENGTH: 1000,
  MAX_OPTION_LENGTH: 500,
  MAX_EXPLANATION_LENGTH: 1500,
  ALLOWED_DIFFICULTIES: ['easy', 'medium', 'hard'],
  ALLOWED_SOURCE_TYPES: ['topic', 'document'],
};

/**
 * Validate and sanitize a single question.
 * Returns { valid: boolean, errors: string[], cleanQuestion?: object }
 */
export function validateQuestion(raw, index = 0) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: [`Question at index ${index} must be an object.`] };
  }

  // Question text
  const questionText = typeof raw.question === 'string' ? raw.question.trim() : '';
  if (!questionText) {
    errors.push(`Question ${index + 1}: question prompt text is required.`);
  } else if (questionText.length > LIMITS.MAX_QUESTION_LENGTH) {
    errors.push(`Question ${index + 1}: prompt exceeds maximum length of ${LIMITS.MAX_QUESTION_LENGTH} characters.`);
  }

  // Options array
  if (!Array.isArray(raw.options)) {
    errors.push(`Question ${index + 1}: options must be an array.`);
  } else if (raw.options.length < LIMITS.MIN_OPTIONS || raw.options.length > LIMITS.MAX_OPTIONS) {
    errors.push(`Question ${index + 1}: must have between ${LIMITS.MIN_OPTIONS} and ${LIMITS.MAX_OPTIONS} options.`);
  } else {
    // Check each option
    raw.options.forEach((opt, optIdx) => {
      const optText = typeof opt === 'string' ? opt.trim() : '';
      if (!optText) {
        errors.push(`Question ${index + 1}, option ${optIdx + 1}: option text cannot be empty.`);
      } else if (optText.length > LIMITS.MAX_OPTION_LENGTH) {
        errors.push(`Question ${index + 1}, option ${optIdx + 1}: option exceeds ${LIMITS.MAX_OPTION_LENGTH} characters.`);
      }
    });
  }

  // Correct index
  const correctIdx = Number(raw.correctIndex);
  if (!Number.isInteger(correctIdx)) {
    errors.push(`Question ${index + 1}: correctIndex must be an integer.`);
  } else if (Array.isArray(raw.options) && (correctIdx < 0 || correctIdx >= raw.options.length)) {
    errors.push(`Question ${index + 1}: correctIndex (${correctIdx}) is out of bounds for ${raw.options.length} options.`);
  }

  // Explanation (optional)
  const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
  if (explanation.length > LIMITS.MAX_EXPLANATION_LENGTH) {
    errors.push(`Question ${index + 1}: explanation exceeds ${LIMITS.MAX_EXPLANATION_LENGTH} characters.`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    cleanQuestion: {
      id: raw.id && typeof raw.id === 'string' ? raw.id : generateQuestionId(index),
      question: questionText,
      options: raw.options.map((o) => (typeof o === 'string' ? o.trim() : String(o))),
      correctIndex: correctIdx,
      explanation,
    },
  };
}

/**
 * Validate and sanitize a complete Quiz document.
 * Returns { valid: boolean, errors: string[], cleanQuiz?: object }
 */
export function validateQuiz(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Quiz data must be a valid object.'] };
  }

  // Title
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) {
    errors.push('Quiz title is required.');
  } else if (title.length > LIMITS.MAX_TITLE_LENGTH) {
    errors.push(`Quiz title exceeds maximum length of ${LIMITS.MAX_TITLE_LENGTH} characters.`);
  }

  // Source Type
  const sourceType = typeof raw.sourceType === 'string' ? raw.sourceType.trim().toLowerCase() : 'topic';
  if (!LIMITS.ALLOWED_SOURCE_TYPES.includes(sourceType)) {
    errors.push(`sourceType must be one of: ${LIMITS.ALLOWED_SOURCE_TYPES.join(', ')}.`);
  }

  // Difficulty
  const difficulty = typeof raw.difficulty === 'string' ? raw.difficulty.trim().toLowerCase() : 'medium';
  if (!LIMITS.ALLOWED_DIFFICULTIES.includes(difficulty)) {
    errors.push(`difficulty must be one of: ${LIMITS.ALLOWED_DIFFICULTIES.join(', ')}.`);
  }

  // Description
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (description.length > LIMITS.MAX_DESC_LENGTH) {
    errors.push(`description exceeds ${LIMITS.MAX_DESC_LENGTH} characters.`);
  }

  // Source Name
  const sourceName = typeof raw.sourceName === 'string' ? raw.sourceName.trim() : '';

  // Questions array
  if (!Array.isArray(raw.questions)) {
    errors.push('Quiz questions must be an array.');
  } else if (raw.questions.length < LIMITS.MIN_QUESTIONS) {
    errors.push(`Quiz must contain at least ${LIMITS.MIN_QUESTIONS} question.`);
  } else if (raw.questions.length > LIMITS.MAX_QUESTIONS) {
    errors.push(`Quiz cannot exceed ${LIMITS.MAX_QUESTIONS} questions (provided ${raw.questions.length}).`);
  }

  // Validate each question
  const cleanQuestions = [];
  if (Array.isArray(raw.questions)) {
    raw.questions.forEach((q, idx) => {
      const qRes = validateQuestion(q, idx);
      if (!qRes.valid) {
        errors.push(...qRes.errors);
      } else {
        cleanQuestions.push(qRes.cleanQuestion);
      }
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const nowIso = new Date().toISOString();
  return {
    valid: true,
    errors: [],
    cleanQuiz: {
      id: raw.id || '', // caller can supply or assign
      title,
      description,
      sourceType,
      sourceName,
      difficulty,
      questionCount: cleanQuestions.length,
      questions: cleanQuestions,
      status: typeof raw.status === 'string' && raw.status ? raw.status : 'ready',
      createdAt: raw.createdAt || nowIso,
      updatedAt: nowIso,
    },
  };
}

/**
 * Validate and sanitize an Attempt document.
 * Returns { valid: boolean, errors: string[], cleanAttempt?: object }
 */
export function validateAttempt(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Attempt data must be a valid object.'] };
  }

  // Quiz ID
  const quizId = typeof raw.quizId === 'string' ? raw.quizId.trim() : '';
  if (!quizId) {
    errors.push('quizId is required for an attempt.');
  }

  // Quiz Title
  const quizTitle = typeof raw.quizTitle === 'string' ? raw.quizTitle.trim() : 'Quiz';

  // Counts
  const totalQuestions = Number(raw.totalQuestions);
  if (!Number.isInteger(totalQuestions) || totalQuestions < LIMITS.MIN_QUESTIONS || totalQuestions > LIMITS.MAX_QUESTIONS) {
    errors.push(`totalQuestions must be an integer between ${LIMITS.MIN_QUESTIONS} and ${LIMITS.MAX_QUESTIONS}.`);
  }

  const correctAnswers = Number(raw.correctAnswers);
  if (!Number.isInteger(correctAnswers) || correctAnswers < 0 || correctAnswers > totalQuestions) {
    errors.push('correctAnswers must be an integer between 0 and totalQuestions.');
  }

  const incorrectAnswers = Number.isInteger(Number(raw.incorrectAnswers))
    ? Math.max(0, Number(raw.incorrectAnswers))
    : Math.max(0, totalQuestions - correctAnswers);

  const unanswered = Number.isInteger(Number(raw.unanswered))
    ? Math.max(0, Number(raw.unanswered))
    : Math.max(0, totalQuestions - (correctAnswers + incorrectAnswers));

  // Score
  let score = Number(raw.score);
  if (Number.isNaN(score) || score < 0 || score > 100) {
    score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  }

  // Time taken (seconds)
  const timeTaken = Math.max(0, Number(raw.timeTaken) || 0);

  // Completed At
  const completedAt = raw.completedAt || new Date().toISOString();

  // Answers map
  const answers = raw.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers)
    ? raw.answers
    : {};

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const nowIso = new Date().toISOString();
  return {
    valid: true,
    errors: [],
    cleanAttempt: {
      id: raw.id || '',
      quizId,
      quizTitle,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      unanswered,
      score,
      startedAt: raw.startedAt || completedAt,
      completedAt,
      timeTaken,
      answers,
      createdAt: raw.createdAt || nowIso,
    },
  };
}
