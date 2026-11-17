import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Layers,
  Play,
  PlusCircle,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../services/auth.jsx';
import { useQuiz } from '../state/QuizContext.jsx';
import { useUI, Badge, EmptyState } from '../../components/ui.jsx';
import { formatQuizDuration } from '../utils/quizHelpers.js';
import { SAMPLE_QUIZZES } from '../utils/sampleQuizzes.js';
import QuizTopBar from '../components/QuizTopBar.jsx';

export default function QuizDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { quizzes, attempts, loading, deleteQuiz, createQuiz } = useQuiz();
  const { confirm, toast } = useUI();
  const [creatingSample, setCreatingSample] = useState(false);

  // Derive real statistics (no hardcoded or fake numbers)
  const totalQuizzes = quizzes.length;
  const totalAttempts = attempts.length;
  const averageScore =
    totalAttempts > 0
      ? Math.round(attempts.reduce((sum, a) => sum + (Number(a.score) || 0), 0) / totalAttempts)
      : 0;
  const totalTimeSeconds = attempts.reduce((sum, a) => sum + (Number(a.timeTaken) || 0), 0);

  // Sorting recent items (newest first)
  const recentQuizzes = [...quizzes]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 4);

  const recentAttempts = [...attempts]
    .sort((a, b) => new Date(b.completedAt || b.createdAt || 0) - new Date(a.completedAt || a.createdAt || 0))
    .slice(0, 4);

  const handleDeleteQuiz = async (e, quizId, title) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'Delete Quiz?',
      message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmLabel: 'Delete Quiz',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteQuiz(quizId);
      toast('Quiz deleted successfully.', 'info');
    } catch (err) {
      toast(err.message || 'Could not delete quiz.', 'error');
    }
  };

  const handleCreateStarterQuiz = async () => {
    setCreatingSample(true);
    try {
      const sample = SAMPLE_QUIZZES[0];
      const created = await createQuiz(sample);
      toast('Starter quiz created! You can now practice it.', 'success');
      navigate(`/quiz/play/${created.id}`);
    } catch (err) {
      toast(err.message || 'Failed to create starter quiz.', 'error');
    } finally {
      setCreatingSample(false);
    }
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

  const getScoreBadgeClass = (score) => {
    if (score >= 80) return 'score-pill score-high';
    if (score >= 60) return 'score-pill score-mid';
    return 'score-pill score-low';
  };

  const displayName = user?.mode === 'guest' ? 'Guest' : (user?.name || 'Student');

  return (
    <div className="quiz-shell">
      <QuizTopBar />

      <main className="quiz-main">
        {/* Hero Section */}
        <section className="quiz-hero-card">
          <div className="quiz-hero-content">
            <div className="landing-pill">
              <Sparkles size={14} className="landing-pill-icon" aria-hidden="true" />
              <span>AI-Powered Practice</span>
            </div>
            <h1>Welcome back, {displayName}!</h1>
            <p className="muted">
              Create AI-assisted quizzes from topics or lecture notes, test yourself with timed sessions,
              and track your concept mastery over time.
            </p>
          </div>
          <div className="quiz-hero-action">
            <button
              className="btn primary"
              onClick={() => navigate('/quiz/create')}
            >
              <PlusCircle size={16} aria-hidden="true" />
              <span>Create New Quiz</span>
            </button>
          </div>
        </section>

        {/* Real Dynamic Stats Grid */}
        <section className="quiz-stats-grid" aria-label="QuizVerse Performance Metrics">
          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Quizzes Created</span>
              <div className="stat-icon-wrap icon-cyan">
                <Layers size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">{totalQuizzes}</div>
            <div className="stat-footer muted small">
              {totalQuizzes === 1 ? '1 practice quiz' : `${totalQuizzes} practice quizzes`} available
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Total Attempts</span>
              <div className="stat-icon-wrap icon-teal">
                <Play size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">{totalAttempts}</div>
            <div className="stat-footer muted small">
              {totalAttempts === 0
                ? 'No attempts yet'
                : `${totalAttempts} ${totalAttempts === 1 ? 'session' : 'sessions'} completed`}
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Average Score</span>
              <div className="stat-icon-wrap icon-amber">
                <Trophy size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">
              {totalAttempts > 0 ? `${averageScore}%` : '0%'}
            </div>
            <div className="stat-footer muted small">
              {totalAttempts > 0 ? `Across ${totalAttempts} attempts` : 'Take a quiz to calculate'}
            </div>
          </div>

          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Time Practiced</span>
              <div className="stat-icon-wrap icon-blue">
                <Clock size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">{formatQuizDuration(totalTimeSeconds)}</div>
            <div className="stat-footer muted small">Total focused practice time</div>
          </div>
        </section>

        {/* Quick Route Cards */}
        <section className="quiz-actions-grid" aria-label="Quick Actions">
          <div className="card quiz-card" onClick={() => navigate('/quiz/create')}>
            <div className="quiz-card-head">
              <div className="quiz-card-icon icon-create">
                <PlusCircle size={22} aria-hidden="true" />
              </div>
              <span className="quiz-badge">Create</span>
            </div>
            <h3>Create a Quiz</h3>
            <p className="muted small">
              Generate MCQs from topics or upload lecture notes in PDF, DOCX, or TXT format.
            </p>
            <div className="quiz-card-foot">
              <span>Open Creator</span>
              <ArrowRight size={14} aria-hidden="true" />
            </div>
          </div>

          <div className="card quiz-card" onClick={() => navigate('/quiz/history')}>
            <div className="quiz-card-head">
              <div className="quiz-card-icon icon-history">
                <History size={22} aria-hidden="true" />
              </div>
              <span className="quiz-badge">History</span>
            </div>
            <h3>Quiz History</h3>
            <p className="muted small">
              Review all past test scores, timing metrics, and question-by-question explanations.
            </p>
            <div className="quiz-card-foot">
              <span>View History</span>
              <ArrowRight size={14} aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Content Section: Recent Quizzes & Recent Attempts */}
        <div className="quiz-columns-grid">
          {/* Recent Quizzes List */}
          <section className="card quiz-section-card" aria-label="Recent Quizzes">
            <header className="card-head">
              <div>
                <h2>Your Practice Quizzes</h2>
                <p className="muted small">Select a quiz to begin an interactive practice session</p>
              </div>
              <button
                className="btn secondary-quiz sm"
                onClick={() => navigate('/quiz/create')}
              >
                <PlusCircle size={14} aria-hidden="true" />
                <span>New Quiz</span>
              </button>
            </header>

            {loading ? (
              <div className="quiz-loading-state">
                <div className="spinner" aria-hidden="true" />
                <p className="muted">Loading your quizzes…</p>
              </div>
            ) : recentQuizzes.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="No quizzes created yet"
                text="Create a quiz from your study topics or lecture notes to start testing your knowledge."
                action={
                  <div className="empty-actions">
                    <button
                      className="btn primary"
                      onClick={() => navigate('/quiz/create')}
                    >
                      <PlusCircle size={15} aria-hidden="true" />
                      <span>Create Your First Quiz</span>
                    </button>
                    <button
                      className="btn ghost"
                      onClick={handleCreateStarterQuiz}
                      disabled={creatingSample}
                    >
                      <Sparkles size={15} aria-hidden="true" />
                      <span>{creatingSample ? 'Creating…' : 'Load Starter Sample Quiz'}</span>
                    </button>
                  </div>
                }
              />
            ) : (
              <div className="quiz-items-list">
                {recentQuizzes.map((quiz) => (
                  <div key={quiz.id} className="quiz-item-row">
                    <div className="quiz-item-main">
                      <div className="quiz-item-title-row">
                        <strong className="quiz-item-title">{quiz.title}</strong>
                        <div className="quiz-item-badges">
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
                      </div>
                      {quiz.description && (
                        <p className="quiz-item-desc muted small">{quiz.description}</p>
                      )}
                      <div className="quiz-item-meta muted small">
                        <span>
                          Created:{' '}
                          {quiz.createdAt
                            ? new Date(quiz.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Recently'}
                        </span>
                      </div>
                    </div>
                    <div className="quiz-item-actions">
                      <button
                        className="btn primary sm"
                        onClick={() => navigate(`/quiz/play/${quiz.id}`)}
                        title="Start Quiz"
                      >
                        <Play size={14} aria-hidden="true" />
                        <span>Take Quiz</span>
                      </button>
                      <button
                        className="icon-btn sm"
                        onClick={(e) => handleDeleteQuiz(e, quiz.id, quiz.title)}
                        title="Delete quiz"
                        aria-label={`Delete quiz ${quiz.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Attempts List */}
          <section className="card quiz-section-card" aria-label="Recent Attempts">
            <header className="card-head">
              <div>
                <h2>Recent Attempts</h2>
                <p className="muted small">Scores and completion metrics from your latest sessions</p>
              </div>
              <button
                className="btn ghost sm"
                onClick={() => navigate('/quiz/history')}
              >
                <span>View All</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </header>

            {loading ? (
              <div className="quiz-loading-state">
                <div className="spinner" aria-hidden="true" />
                <p className="muted">Loading attempts…</p>
              </div>
            ) : recentAttempts.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title="No attempts recorded yet"
                text="Take any quiz to record your score, elapsed time, and detailed answer explanations."
                action={
                  recentQuizzes.length > 0 ? (
                    <button
                      className="btn primary sm"
                      onClick={() => navigate(`/quiz/play/${recentQuizzes[0].id}`)}
                    >
                      <Play size={14} aria-hidden="true" />
                      <span>Take First Quiz</span>
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="quiz-items-list">
                {recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="quiz-item-row attempt-row">
                    <div className="quiz-item-main">
                      <div className="quiz-item-title-row">
                        <strong className="quiz-item-title">{attempt.quizTitle || 'Quiz'}</strong>
                        <span className={getScoreBadgeClass(attempt.score)}>
                          {attempt.score}%
                        </span>
                      </div>
                      <div className="quiz-attempt-stats muted small">
                        <span>
                          <CheckCircle2 size={13} aria-hidden="true" />
                          {attempt.correctAnswers} / {attempt.totalQuestions} correct
                        </span>
                        <span>
                          <Clock size={13} aria-hidden="true" />
                          {formatQuizDuration(attempt.timeTaken)}
                        </span>
                        <span>
                          {attempt.completedAt
                            ? new Date(attempt.completedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Today'}
                        </span>
                      </div>
                    </div>
                    <div className="quiz-item-actions">
                      <button
                        className="btn ghost sm"
                        onClick={() => navigate(`/quiz/result/${attempt.id}`)}
                        title="View Detailed Results"
                      >
                        <span>Results</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
