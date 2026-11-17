import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid,
  Send,
  X,
} from 'lucide-react';
import { useQuiz } from '../state/QuizContext.jsx';
import { useUI, Badge, ProgressBar } from '../../components/ui.jsx';
import { formatQuizDuration, generateAttemptId } from '../utils/quizHelpers.js';
import QuizTopBar from '../components/QuizTopBar.jsx';

export default function QuizPlay() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { getQuiz, recordAttempt } = useQuiz();
  const { confirm, toast } = useUI();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Player state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionIndex }
  const [showReviewTray, setShowReviewTray] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timestamp-based elapsed timer
  const startTimeRef = useRef(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Fetch target quiz
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setNotFound(false);
      try {
        const found = await getQuiz(quizId);
        if (!active) return;
        if (!found || !Array.isArray(found.questions) || found.questions.length === 0) {
          setNotFound(true);
        } else {
          setQuiz(found);
          startTimeRef.current = Date.now();
        }
      } catch (err) {
        console.error('Failed to load quiz:', err);
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [quizId, getQuiz]);

  // Timer interval using timestamp difference to avoid background tab drift
  useEffect(() => {
    if (!quiz || notFound) return undefined;
    const interval = setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
      setElapsedSeconds(elapsed);
    }, 1000);
    return () => clearInterval(interval);
  }, [quiz, notFound]);

  const questions = quiz?.questions || [];
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;

  // Handle option selection
  const handleSelectOption = (optionIndex) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionIndex,
    }));
  };

  // Exit quiz handler with confirmation
  const handleExitQuiz = async () => {
    if (answeredCount > 0) {
      const ok = await confirm({
        title: 'Exit Quiz?',
        message: 'Your progress in this practice session will not be saved. Are you sure you want to exit?',
        confirmLabel: 'Exit Session',
        danger: true,
      });
      if (!ok) return;
    }
    navigate('/quiz');
  };

  // Submit quiz and calculate results
  const handleSubmit = async () => {
    if (unansweredCount > 0) {
      const ok = await confirm({
        title: 'Submit Quiz?',
        message: `You have ${unansweredCount} unanswered ${
          unansweredCount === 1 ? 'question' : 'questions'
        }. Do you want to submit your quiz now?`,
        confirmLabel: 'Submit Quiz',
      });
      if (!ok) return;
    }

    setIsSubmitting(true);
    try {
      // Calculate score metrics
      let correct = 0;
      let incorrect = 0;
      let unanswered = 0;

      questions.forEach((q) => {
        const chosen = answers[q.id];
        if (chosen === undefined) {
          unanswered += 1;
        } else if (Number(chosen) === Number(q.correctIndex)) {
          correct += 1;
        } else {
          incorrect += 1;
        }
      });

      const score = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
      const durationSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      const attemptId = generateAttemptId();

      const attemptRecord = {
        id: attemptId,
        quizId: quiz.id,
        quizTitle: quiz.title,
        totalQuestions,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
        unanswered,
        score,
        startedAt: new Date(startTimeRef.current).toISOString(),
        completedAt: new Date().toISOString(),
        timeTaken: durationSeconds,
        answers,
      };

      await recordAttempt(attemptRecord);
      toast(`Quiz completed! You scored ${score}%.`, 'success');
      navigate(`/quiz/result/${attemptId}`);
    } catch (err) {
      toast(err.message || 'Failed to submit quiz attempt.', 'error');
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="quiz-shell">
        <QuizTopBar />
        <main className="quiz-main">
          <div className="quiz-loading-container">
            <div className="spinner lg" aria-hidden="true" />
            <h2>Loading Quiz…</h2>
            <p className="muted">Preparing questions and practice environment.</p>
          </div>
        </main>
      </div>
    );
  }

  // Quiz Not Found state
  if (notFound || !quiz) {
    return (
      <div className="quiz-shell">
        <QuizTopBar />
        <main className="quiz-main">
          <div className="quiz-placeholder-container">
            <div className="card quiz-not-found-card">
              <div className="not-found-icon">
                <AlertCircle size={36} aria-hidden="true" />
              </div>
              <h2>Quiz Not Found</h2>
              <p className="muted">
                The requested quiz <code>{quizId}</code> could not be found. It may have been deleted
                or does not exist.
              </p>
              <div className="not-found-actions">
                <button
                  className="btn primary"
                  onClick={() => navigate('/quiz')}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  <span>Return to QuizVerse Dashboard</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const optionLetters = ['A', 'B', 'C', 'D'];
  const progressPercent = ((currentIndex + 1) / totalQuestions) * 100;

  return (
    <div className="quiz-shell quiz-play-shell">
      {/* Quiz Player Navigation Header */}
      <header className="quiz-play-header">
        <div className="quiz-play-header-inner">
          <div className="quiz-play-title-group">
            <button
              className="btn ghost sm exit-quiz-btn"
              onClick={handleExitQuiz}
              title="Exit Quiz"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Exit</span>
            </button>
            <div className="quiz-play-title-wrap">
              <h1 className="quiz-play-title">{quiz.title}</h1>
              {quiz.difficulty && (
                <Badge tone="teal">{quiz.difficulty.toUpperCase()}</Badge>
              )}
            </div>
          </div>

          <div className="quiz-play-metrics">
            <div className="timer-badge" title="Elapsed Time">
              <Clock size={16} className="timer-icon" aria-hidden="true" />
              <span className="timer-value">{formatQuizDuration(elapsedSeconds)}</span>
            </div>
            <button
              className="btn secondary-quiz sm review-drawer-btn"
              onClick={() => setShowReviewTray((prev) => !prev)}
              aria-label="Toggle Question Review Tray"
            >
              <Grid size={15} aria-hidden="true" />
              <span>Review ({answeredCount}/{totalQuestions})</span>
            </button>
          </div>
        </div>

        {/* Progress Bar Header */}
        <div className="quiz-progress-wrapper">
          <div className="quiz-progress-text">
            <span>
              Question <strong>{currentIndex + 1}</strong> of <strong>{totalQuestions}</strong>
            </span>
            <span className="muted small">
              {unansweredCount === 0
                ? 'All answered'
                : `${unansweredCount} remaining`}
            </span>
          </div>
          <ProgressBar value={progressPercent} height={6} />
        </div>
      </header>

      {/* Main Play Area */}
      <main className="quiz-play-main">
        <div className="quiz-play-layout">
          {/* Active Question Box */}
          <div className="card question-card">
            <div className="question-header">
              <span className="question-index-pill">Question {currentIndex + 1}</span>
              {answers[currentQuestion.id] !== undefined ? (
                <span className="answered-pill">
                  <CheckCircle2 size={13} aria-hidden="true" /> Answered
                </span>
              ) : (
                <span className="unanswered-pill">Unanswered</span>
              )}
            </div>

            <h2 className="question-text">{currentQuestion.question}</h2>

            {/* Options List */}
            <div
              className="options-list"
              role="radiogroup"
              aria-label={`Options for question ${currentIndex + 1}`}
            >
              {currentQuestion.options.map((optText, optIdx) => {
                const isSelected = answers[currentQuestion.id] === optIdx;
                return (
                  <button
                    key={optIdx}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`option-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectOption(optIdx)}
                  >
                    <span className="option-letter">{optionLetters[optIdx] || optIdx + 1}</span>
                    <span className="option-label">{optText}</span>
                    {isSelected && (
                      <span className="option-check" aria-hidden="true">
                        <CheckCircle2 size={18} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Question Bottom Navigation Controls */}
            <div className="question-controls-footer">
              <button
                type="button"
                className="btn ghost prev-btn"
                onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                <span>Previous</span>
              </button>

              <div className="controls-right">
                {currentIndex < totalQuestions - 1 ? (
                  <button
                    type="button"
                    className="btn primary next-btn"
                    onClick={() => setCurrentIndex((idx) => Math.min(totalQuestions - 1, idx + 1))}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn primary submit-btn"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <Send size={15} aria-hidden="true" />
                    <span>{isSubmitting ? 'Submitting…' : 'Submit Quiz'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Question Review Drawer / Tray */}
          <aside className={`quiz-review-drawer ${showReviewTray ? 'open' : ''}`}>
            <div className="review-drawer-head">
              <div className="review-drawer-title">
                <Grid size={16} aria-hidden="true" />
                <strong>Questions Overview</strong>
              </div>
              <button
                type="button"
                className="icon-btn sm"
                onClick={() => setShowReviewTray(false)}
                aria-label="Close overview"
              >
                <X size={16} />
              </button>
            </div>

            <div className="review-drawer-body">
              <div className="review-grid">
                {questions.map((q, idx) => {
                  const isAnswered = answers[q.id] !== undefined;
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      className={`review-grid-btn ${isCurrent ? 'current' : ''} ${
                        isAnswered ? 'answered' : 'unanswered'
                      }`}
                      onClick={() => {
                        setCurrentIndex(idx);
                        if (window.innerWidth < 900) setShowReviewTray(false);
                      }}
                      title={`Question ${idx + 1}: ${isAnswered ? 'Answered' : 'Unanswered'}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="review-legend">
                <div className="legend-item">
                  <span className="legend-dot answered" />
                  <span className="muted small">Answered ({answeredCount})</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot unanswered" />
                  <span className="muted small">Unanswered ({unansweredCount})</span>
                </div>
              </div>

              <button
                type="button"
                className="btn primary full-width submit-drawer-btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                <Send size={15} aria-hidden="true" />
                <span>{isSubmitting ? 'Submitting…' : 'Finish & Submit'}</span>
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
