import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  History,
  Layers,
  Play,
  PlusCircle,
  RotateCcw,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useQuiz } from '../state/QuizContext.jsx';
import { useUI, Badge, EmptyState } from '../../components/ui.jsx';
import { formatQuizDuration } from '../utils/quizHelpers.js';
import QuizTopBar from '../components/QuizTopBar.jsx';

export default function QuizHistory() {
  const navigate = useNavigate();
  const { attempts, quizzes, loading, deleteAttempt, deleteQuiz } = useQuiz();
  const { confirm, toast } = useUI();

  const [activeTab, setActiveTab] = useState('attempts'); // 'attempts' | 'quizzes'
  const [searchQuery, setSearchQuery] = useState('');

  const handleDeleteAttempt = async (e, attemptId, title) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Attempt?',
      message: `Delete attempt record for "${title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAttempt(attemptId);
      toast('Attempt deleted.', 'info');
    } catch (err) {
      toast(err.message || 'Failed to delete attempt.', 'error');
    }
  };

  const handleDeleteQuiz = async (e, quizId, title) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Quiz?',
      message: `Are you sure you want to delete "${title}"? Past attempts will remain in your history.`,
      confirmLabel: 'Delete Quiz',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteQuiz(quizId);
      toast('Quiz deleted.', 'info');
    } catch (err) {
      toast(err.message || 'Failed to delete quiz.', 'error');
    }
  };

  const getScoreBadgeClass = (score) => {
    if (score >= 80) return 'score-pill score-high';
    if (score >= 60) return 'score-pill score-mid';
    return 'score-pill score-low';
  };

  const getDifficultyTone = (diff) => {
    switch ((diff || '').toLowerCase()) {
      case 'easy':
        return 'emerald';
      case 'hard':
        return 'rose';
      case 'medium':
      default:
        return 'teal';
    }
  };

  // Filtered and sorted lists
  const filteredAttempts = attempts
    .filter((a) =>
      searchQuery ? (a.quizTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) : true,
    )
    .sort((a, b) => new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0));

  const filteredQuizzes = quizzes
    .filter((q) =>
      searchQuery
        ? (q.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (q.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        : true,
    )
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return (
    <div className="quiz-shell">
      <QuizTopBar />

      <main className="quiz-main">
        {/* Header */}
        <div className="quiz-create-header">
          <button
            className="btn ghost sm back-btn"
            onClick={() => navigate('/quiz')}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to Dashboard</span>
          </button>
          <h1>Quiz History & Library</h1>
          <p className="muted">
            Track your past practice sessions, review scores and timing, or manage your quiz library.
          </p>
        </div>

        {/* Tab Controls & Search */}
        <div className="history-toolbar">
          <div className="history-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'attempts'}
              className={`history-tab ${activeTab === 'attempts' ? 'active' : ''}`}
              onClick={() => setActiveTab('attempts')}
            >
              <History size={16} aria-hidden="true" />
              <span>Practice Attempts ({attempts.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'quizzes'}
              className={`history-tab ${activeTab === 'quizzes' ? 'active' : ''}`}
              onClick={() => setActiveTab('quizzes')}
            >
              <BookOpen size={16} aria-hidden="true" />
              <span>Saved Quizzes ({quizzes.length})</span>
            </button>
          </div>

          <div className="history-search">
            <input
              type="search"
              placeholder={activeTab === 'attempts' ? 'Search attempts…' : 'Search quizzes…'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter history"
            />
          </div>
        </div>

        {/* Tab 1: Practice Attempts */}
        {activeTab === 'attempts' && (
          <section className="card history-content-card">
            {loading ? (
              <div className="quiz-loading-state">
                <div className="spinner" aria-hidden="true" />
                <p className="muted">Loading your attempt history…</p>
              </div>
            ) : filteredAttempts.length === 0 ? (
              <EmptyState
                icon={History}
                title={searchQuery ? 'No matching attempts found' : 'No quiz attempts recorded'}
                text={
                  searchQuery
                    ? 'Try searching with a different keyword.'
                    : 'Take a quiz to see your scores, completion times, and detailed rationales.'
                }
                action={
                  quizzes.length > 0 ? (
                    <button
                      className="btn primary"
                      onClick={() => navigate(`/quiz/play/${quizzes[0].id}`)}
                    >
                      <Play size={16} aria-hidden="true" />
                      <span>Take a Quiz Now</span>
                    </button>
                  ) : (
                    <button
                      className="btn primary"
                      onClick={() => navigate('/quiz/create')}
                    >
                      <PlusCircle size={16} aria-hidden="true" />
                      <span>Create Your First Quiz</span>
                    </button>
                  )
                }
              />
            ) : (
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Quiz Title</th>
                      <th>Score</th>
                      <th>Accuracy</th>
                      <th>Duration</th>
                      <th>Date</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttempts.map((attempt) => (
                      <tr key={attempt.id} className="history-tr">
                        <td className="quiz-title-cell">
                          <strong>{attempt.quizTitle || 'Quiz'}</strong>
                        </td>
                        <td>
                          <span className={getScoreBadgeClass(attempt.score)}>
                            {attempt.score}%
                          </span>
                        </td>
                        <td className="muted small">
                          <CheckCircle2 size={13} className="teal-icon" aria-hidden="true" />
                          <span>
                            {attempt.correctAnswers} / {attempt.totalQuestions}
                          </span>
                        </td>
                        <td className="muted small">
                          <Clock size={13} aria-hidden="true" />
                          <span>{formatQuizDuration(attempt.timeTaken)}</span>
                        </td>
                        <td className="muted small">
                          {attempt.completedAt
                            ? new Date(attempt.completedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Recently'}
                        </td>
                        <td className="actions-cell text-right">
                          <button
                            className="btn ghost sm"
                            onClick={() => navigate(`/quiz/result/${attempt.id}`)}
                            title="View Explanations & Score Breakdown"
                          >
                            <span>Results</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </button>

                          {attempt.quizId && (
                            <button
                              className="btn primary sm"
                              onClick={() => navigate(`/quiz/play/${attempt.quizId}`)}
                              title="Retake Quiz"
                            >
                              <RotateCcw size={13} aria-hidden="true" />
                              <span>Retake</span>
                            </button>
                          )}

                          <button
                            className="icon-btn sm"
                            onClick={(e) => handleDeleteAttempt(e, attempt.id, attempt.quizTitle)}
                            title="Delete attempt"
                            aria-label={`Delete attempt for ${attempt.quizTitle}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Saved Quizzes */}
        {activeTab === 'quizzes' && (
          <section className="card history-content-card">
            {loading ? (
              <div className="quiz-loading-state">
                <div className="spinner" aria-hidden="true" />
                <p className="muted">Loading quizzes…</p>
              </div>
            ) : filteredQuizzes.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={searchQuery ? 'No matching quizzes' : 'No quizzes in your library'}
                text={
                  searchQuery
                    ? 'No quizzes match your search query.'
                    : 'Create practice quizzes from any subject topic or lecture notes.'
                }
                action={
                  <button
                    className="btn primary"
                    onClick={() => navigate('/quiz/create')}
                  >
                    <PlusCircle size={16} aria-hidden="true" />
                    <span>Create New Quiz</span>
                  </button>
                }
              />
            ) : (
              <div className="quizzes-grid">
                {filteredQuizzes.map((quiz) => (
                  <div key={quiz.id} className="card quiz-library-card">
                    <div className="quiz-lib-head">
                      <div className="quiz-lib-badges">
                        <Badge tone={getDifficultyTone(quiz.difficulty)}>
                          {quiz.difficulty ? quiz.difficulty.toUpperCase() : 'MEDIUM'}
                        </Badge>
                        <Badge tone="slate">
                          {quiz.questions?.length || quiz.questionCount || 0} Questions
                        </Badge>
                        {quiz.sourceType && (
                          <Badge tone="cyan">
                            {quiz.sourceType === 'document' ? 'Document' : 'Topic'}
                          </Badge>
                        )}
                      </div>
                      <button
                        className="icon-btn sm"
                        onClick={(e) => handleDeleteQuiz(e, quiz.id, quiz.title)}
                        title="Delete quiz"
                        aria-label={`Delete quiz ${quiz.title}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <h3 className="quiz-lib-title">{quiz.title}</h3>
                    {quiz.description && (
                      <p className="quiz-lib-desc muted small">{quiz.description}</p>
                    )}

                    <div className="quiz-lib-foot">
                      <span className="muted small">
                        Created:{' '}
                        {quiz.createdAt
                          ? new Date(quiz.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Recently'}
                      </span>
                      <button
                        className="btn primary sm"
                        onClick={() => navigate(`/quiz/play/${quiz.id}`)}
                      >
                        <Play size={14} aria-hidden="true" />
                        <span>Play Quiz</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
