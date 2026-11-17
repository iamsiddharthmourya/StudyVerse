// Centralized state container for QuizVerse
// Provides quizzes, attempt history, and storage actions to all QuizVerse views
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../services/auth.jsx';
import {
  createQuiz as storageCreateQuiz,
  deleteAttempt as storageDeleteAttempt,
  deleteQuiz as storageDeleteQuiz,
  getAttempt as storageGetAttempt,
  getQuiz as storageGetQuiz,
  listAttempts as storageListAttempts,
  listQuizzes as storageListQuizzes,
  saveAttempt as storageSaveAttempt,
  updateQuiz as storageUpdateQuiz,
} from '../services/quizStorage.js';

const QuizContext = createContext(null);

export function QuizProvider({ children }) {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reload all quizzes and attempts for the current user
  const refresh = useCallback(async () => {
    if (!user) {
      setQuizzes([]);
      setAttempts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [fetchedQuizzes, fetchedAttempts] = await Promise.all([
        storageListQuizzes(user),
        storageListAttempts(user),
      ]);
      setQuizzes(fetchedQuizzes);
      setAttempts(fetchedAttempts);
    } catch (err) {
      console.error('Failed to load QuizVerse data:', err);
      setError(err?.message || 'Could not load your quizzes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Create Quiz Action
  const createQuiz = useCallback(
    async (rawData) => {
      setError('');
      try {
        const created = await storageCreateQuiz(user, rawData);
        setQuizzes((prev) => [created, ...prev.filter((q) => q.id !== created.id)]);
        return created;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [user],
  );

  // Update Quiz Action
  const updateQuiz = useCallback(
    async (quizId, patch) => {
      setError('');
      try {
        const updated = await storageUpdateQuiz(user, quizId, patch);
        setQuizzes((prev) => prev.map((q) => (q.id === quizId ? updated : q)));
        return updated;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [user],
  );

  // Delete Quiz Action
  const deleteQuiz = useCallback(
    async (quizId) => {
      setError('');
      try {
        await storageDeleteQuiz(user, quizId);
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
        return true;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [user],
  );

  // Get Quiz by ID
  const getQuiz = useCallback(
    async (quizId) => {
      // Return local cache if available
      const found = quizzes.find((q) => q.id === quizId);
      if (found) return found;
      return storageGetQuiz(user, quizId);
    },
    [user, quizzes],
  );

  // Record Attempt Action
  const recordAttempt = useCallback(
    async (rawAttempt) => {
      setError('');
      try {
        const recorded = await storageSaveAttempt(user, rawAttempt);
        setAttempts((prev) => [recorded, ...prev.filter((a) => a.id !== recorded.id)]);
        return recorded;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [user],
  );

  // Get Attempt by ID
  const getAttempt = useCallback(
    async (attemptId) => {
      const found = attempts.find((a) => a.id === attemptId);
      if (found) return found;
      return storageGetAttempt(user, attemptId);
    },
    [user, attempts],
  );

  // Delete Attempt Action
  const deleteAttempt = useCallback(
    async (attemptId) => {
      setError('');
      try {
        await storageDeleteAttempt(user, attemptId);
        setAttempts((prev) => prev.filter((a) => a.id !== attemptId));
        return true;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [user],
  );

  const value = useMemo(
    () => ({
      quizzes,
      attempts,
      loading,
      error,
      refresh,
      createQuiz,
      updateQuiz,
      deleteQuiz,
      getQuiz,
      recordAttempt,
      getAttempt,
      deleteAttempt,
    }),
    [
      quizzes,
      attempts,
      loading,
      error,
      refresh,
      createQuiz,
      updateQuiz,
      deleteQuiz,
      getQuiz,
      recordAttempt,
      getAttempt,
      deleteAttempt,
    ],
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) {
    throw new Error('useQuiz must be used within a <QuizProvider>');
  }
  return ctx;
}
