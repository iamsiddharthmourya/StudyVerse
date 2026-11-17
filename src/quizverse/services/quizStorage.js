// Unified Storage Service for QuizVerse
//  - Google users: Firestore subcollections  /users/{uid}/quizzes/{quizId}  and  /users/{uid}/attempts/{attemptId}
//  - Guest users: LocalStorage keys  qv:quizzes:guest  and  qv:attempts:guest
//
// CRITICAL: This service strictly avoids touching the StudyVerse root document (/users/{uid})
// and StudyVerse LocalStorage (ssp:data:guest).
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, setDoc, where } from 'firebase/firestore';
import { firebase } from '../../services/firebase.js';
import { cleanForFirestore, generateAttemptId, generateQuizId } from '../utils/quizHelpers.js';
import { validateAttempt, validateQuiz } from './quizValidation.js';

export const GUEST_STORAGE_KEYS = {
  QUIZZES: 'qv:quizzes:guest',
  ATTEMPTS: 'qv:attempts:guest',
};

// ==========================================================================
// Guest LocalStorage Operations
// ==========================================================================

function readGuestList(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Error reading guest storage key "${key}":`, err);
    return [];
  }
}

function writeGuestList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch (err) {
    console.error(`Error writing guest storage key "${key}":`, err);
    return false;
  }
}

// ==========================================================================
// Quiz Storage Operations
// ==========================================================================

/**
 * List all quizzes for the current user.
 * Returns Array of sanitized quiz objects ordered by createdAt descending.
 */
export async function listQuizzes(user) {
  if (!user) return [];

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.QUIZZES);
    return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  // Google User (Cloud Firestore subcollection)
  try {
    const collRef = collection(firebase.db, 'users', user.uid, 'quizzes');
    const q = query(collRef, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const results = [];
    snap.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...docSnap.data() });
    });
    return results;
  } catch (err) {
    console.error('Failed to list quizzes from Firestore:', err);
    throw err;
  }
}

/**
 * Retrieve a single quiz by ID.
 * Returns quiz object or null if not found.
 */
export async function getQuiz(user, quizId) {
  if (!user || !quizId) return null;

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.QUIZZES);
    return list.find((q) => q.id === quizId) || null;
  }

  // Google User
  try {
    const docRef = doc(firebase.db, 'users', user.uid, 'quizzes', quizId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error(`Failed to get quiz "${quizId}" from Firestore:`, err);
    throw err;
  }
}

/**
 * Create a new quiz.
 * Validates schema and assigns ID.
 * Returns the created clean quiz object.
 */
export async function createQuiz(user, rawQuiz) {
  if (!user) throw new Error('User authentication required to create a quiz.');

  const validation = validateQuiz(rawQuiz);
  if (!validation.valid) {
    throw new Error(`Invalid quiz data: ${validation.errors.join(' ')}`);
  }

  const quiz = {
    ...validation.cleanQuiz,
    id: validation.cleanQuiz.id || generateQuizId(),
  };

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.QUIZZES);
    list.unshift(quiz);
    writeGuestList(GUEST_STORAGE_KEYS.QUIZZES, list);
    return quiz;
  }

  // Google User (Firestore subcollection: /users/{uid}/quizzes/{quizId})
  try {
    const docRef = doc(firebase.db, 'users', user.uid, 'quizzes', quiz.id);
    await setDoc(docRef, cleanForFirestore(quiz));
    return quiz;
  } catch (err) {
    console.error('Failed to create quiz in Firestore:', err);
    throw err;
  }
}

/**
 * Update an existing quiz.
 * Merges updates, validates, and updates updatedAt.
 * Returns updated quiz object.
 */
export async function updateQuiz(user, quizId, patch) {
  if (!user || !quizId) throw new Error('User and quizId are required to update a quiz.');

  const existing = await getQuiz(user, quizId);
  if (!existing) throw new Error(`Quiz with ID "${quizId}" not found.`);

  const merged = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  const validation = validateQuiz(merged);
  if (!validation.valid) {
    throw new Error(`Invalid update data: ${validation.errors.join(' ')}`);
  }

  const updatedQuiz = validation.cleanQuiz;

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.QUIZZES);
    const nextList = list.map((q) => (q.id === quizId ? updatedQuiz : q));
    writeGuestList(GUEST_STORAGE_KEYS.QUIZZES, nextList);
    return updatedQuiz;
  }

  // Google User
  try {
    const docRef = doc(firebase.db, 'users', user.uid, 'quizzes', quizId);
    await setDoc(docRef, cleanForFirestore(updatedQuiz));
    return updatedQuiz;
  } catch (err) {
    console.error(`Failed to update quiz "${quizId}" in Firestore:`, err);
    throw err;
  }
}

/**
 * Delete a quiz by ID.
 * Returns true if successful.
 */
export async function deleteQuiz(user, quizId) {
  if (!user || !quizId) return false;

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.QUIZZES);
    const filtered = list.filter((q) => q.id !== quizId);
    writeGuestList(GUEST_STORAGE_KEYS.QUIZZES, filtered);
    return true;
  }

  // Google User
  try {
    const docRef = doc(firebase.db, 'users', user.uid, 'quizzes', quizId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Failed to delete quiz "${quizId}" from Firestore:`, err);
    throw err;
  }
}

// ==========================================================================
// Attempt Storage Operations
// ==========================================================================

/**
 * Record a new quiz attempt.
 * Validates schema and assigns ID.
 * Returns the created clean attempt object.
 */
export async function saveAttempt(user, rawAttempt) {
  if (!user) throw new Error('User authentication required to record an attempt.');

  const validation = validateAttempt(rawAttempt);
  if (!validation.valid) {
    throw new Error(`Invalid attempt data: ${validation.errors.join(' ')}`);
  }

  const attempt = {
    ...validation.cleanAttempt,
    id: validation.cleanAttempt.id || generateAttemptId(),
  };

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.ATTEMPTS);
    list.unshift(attempt);
    writeGuestList(GUEST_STORAGE_KEYS.ATTEMPTS, list);
    return attempt;
  }

  // Google User (Firestore subcollection: /users/{uid}/attempts/{attemptId})
  try {
    const docRef = doc(firebase.db, 'users', user.uid, 'attempts', attempt.id);
    await setDoc(docRef, cleanForFirestore(attempt));
    return attempt;
  } catch (err) {
    console.error('Failed to save attempt in Firestore:', err);
    throw err;
  }
}

/**
 * List attempts for the user, optionally filtered by quizId.
 * Returns Array of attempt objects ordered by completedAt descending.
 */
export async function listAttempts(user, quizId = null) {
  if (!user) return [];

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.ATTEMPTS);
    const filtered = quizId ? list.filter((a) => a.quizId === quizId) : list;
    return filtered.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  }

  // Google User
  try {
    const collRef = collection(firebase.db, 'users', user.uid, 'attempts');
    let q = query(collRef, orderBy('completedAt', 'desc'));
    if (quizId) {
      q = query(collRef, where('quizId', '==', quizId), orderBy('completedAt', 'desc'));
    }
    const snap = await getDocs(q);
    const results = [];
    snap.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...docSnap.data() });
    });
    return results;
  } catch (err) {
    console.error('Failed to list attempts from Firestore:', err);
    throw err;
  }
}

/**
 * Retrieve a single attempt by ID.
 */
export async function getAttempt(user, attemptId) {
  if (!user || !attemptId) return null;

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.ATTEMPTS);
    return list.find((a) => a.id === attemptId) || null;
  }

  // Google User
  try {
    const docRef = doc(firebase.db, 'users', user.uid, 'attempts', attemptId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error(`Failed to get attempt "${attemptId}" from Firestore:`, err);
    throw err;
  }
}

/**
 * Delete an attempt by ID.
 */
export async function deleteAttempt(user, attemptId) {
  if (!user || !attemptId) return false;

  // Guest Mode
  if (user.mode === 'guest' || !firebase.ready) {
    const list = readGuestList(GUEST_STORAGE_KEYS.ATTEMPTS);
    const filtered = list.filter((a) => a.id !== attemptId);
    writeGuestList(GUEST_STORAGE_KEYS.ATTEMPTS, filtered);
    return true;
  }

  // Google User
  try {
    const docRef = doc(firebase.db, 'users', user.uid, 'attempts', attemptId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Failed to delete attempt "${attemptId}" from Firestore:`, err);
    throw err;
  }
}
