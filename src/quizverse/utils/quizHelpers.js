// Utility helper functions for QuizVerse: ID generation, formatting, and data sanitization

/**
 * Generate a unique ID for a Quiz.
 * Format: qz_<timestamp36>_<random6>
 */
export function generateQuizId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `qz_${ts}_${rand}`;
}

/**
 * Generate a unique ID for an Attempt.
 * Format: att_<timestamp36>_<random6>
 */
export function generateAttemptId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `att_${ts}_${rand}`;
}

/**
 * Generate a unique ID for a Question within a Quiz.
 * Format: q_<index>_<random4>
 */
export function generateQuestionId(index = 0) {
  const rand = Math.random().toString(36).substring(2, 6);
  return `q_${index + 1}_${rand}`;
}

/**
 * Clean an object for Firestore storage (strips undefined values which Firestore rejects).
 */
export function cleanForFirestore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format elapsed time in seconds to human-readable string (e.g. "2m 15s" or "45s").
 */
export function formatQuizDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (!m) return `${rem}s`;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

/**
 * Calculate percentage score rounded to nearest whole number.
 */
export function computeScore(total, correct) {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((correct / total) * 100)));
}
