import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  GraduationCap,
  HelpCircle,
  History,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useQuiz } from '../state/QuizContext.jsx';
import { formatQuizDuration } from '../utils/quizHelpers.js';
import QuizTopBar from '../components/QuizTopBar.jsx';

export default function QuizResult() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { getAttempt, getQuiz } = useQuiz();

  const [attempt, setAttempt] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setNotFound(false);
      try {
        const att = await getAttempt(attemptId);
        if (!active) return;
        if (!att) {
          setNotFound(true);
          return;
        }
        setAttempt(att);

        // Fetch matching quiz for question texts and explanations
        if (att.quizId) {
          try {
            const q = await getQuiz(att.quizId);
            if (active && q) {
              setQuiz(q);
            }
          } catch {
            // Quiz may have been deleted, results can still be displayed
          }
        }
      } catch (err) {
        console.error('Failed to load attempt:', err);
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [attemptId, getAttempt, getQuiz]);

  if (loading) {
    return (
      <div className="quiz-shell">
        <QuizTopBar />
        <main className="quiz-main">
          <div className="quiz-loading-container">
            <div className="spinner lg" aria-hidden="true" />
            <h2>Loading Results…</h2>
            <p className="muted">Fetching your score, timing, and explanations.</p>
          </div>
        </main>
      </div>
    );
  }

  if (notFound || !attempt) {
    return (
      <div className="quiz-shell">
        <QuizTopBar />
        <main className="quiz-main">
          <div className="quiz-placeholder-container">
            <div className="card quiz-not-found-card">
              <div className="not-found-icon">
                <AlertCircle size={36} aria-hidden="true" />
              </div>
              <h2>Attempt Not Found</h2>
              <p className="muted">
                The requested attempt record <code>{attemptId}</code> could not be found.
              </p>
              <div className="not-found-actions">
                <button
                  className="btn primary"
                  onClick={() => navigate('/quiz')}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  <span>Return to QuizVerse</span>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const score = Number(attempt.score) || 0;
  const questions = quiz?.questions || [];

  const getTierInfo = (sc) => {
    if (sc >= 90) {
      return {
        badge: 'Mastery Achieved! 🏆',
        tone: 'high',
        text: 'Outstanding performance! You demonstrated a complete grasp of this material.',
      };
    }
    if (sc >= 75) {
      return {
        badge: 'Great Job! 🎯',
        tone: 'high',
        text: 'Strong understanding! Only a few questions missed.',
      };
    }
    if (sc >= 50) {
      return {
        badge: 'Good Effort! 📚',
        tone: 'mid',
        text: 'Good foundation. Review the missed questions below to solidify your understanding.',
      };
    }
    return {
      badge: 'Keep Practicing 💡',
      tone: 'low',
      text: 'This was a challenging set. Review the explanations below and give it another try.',
    };
  };

  const tier = getTierInfo(score);
  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="quiz-shell">
      <QuizTopBar />

      <main className="quiz-main">
        {/* Results Header Banner */}
        <section className={`card result-hero-card result-tone-${tier.tone}`}>
          <div className="result-hero-content">
            <div className="result-badge-pill">
              <Trophy size={16} aria-hidden="true" />
              <span>{tier.badge}</span>
            </div>
            <h1>{attempt.quizTitle || 'Quiz Performance'}</h1>
            <p className="muted">{tier.text}</p>
            <div className="result-meta-row muted small">
              <span>
                <Clock size={14} aria-hidden="true" /> Completed in{' '}
                <strong>{formatQuizDuration(attempt.timeTaken)}</strong>
              </span>
              <span>•</span>
              <span>
                {attempt.completedAt
                  ? new Date(attempt.completedAt).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Just now'}
              </span>
            </div>
          </div>

          <div className="result-score-circle">
            <div className="score-number">{score}%</div>
            <div className="score-label">Final Score</div>
          </div>
        </section>

        {/* 4 Metrics Tiles */}
        <section className="quiz-stats-grid" aria-label="Score Breakdown">
          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Total Questions</span>
              <div className="stat-icon-wrap icon-cyan">
                <HelpCircle size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">{attempt.totalQuestions}</div>
            <div className="stat-footer muted small">Session question count</div>
          </div>

          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Correct Answers</span>
              <div className="stat-icon-wrap icon-teal">
                <CheckCircle2 size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">{attempt.correctAnswers}</div>
            <div className="stat-footer muted small">Answered accurately</div>
          </div>

          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Incorrect Answers</span>
              <div className="stat-icon-wrap icon-rose">
                <XCircle size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">{attempt.incorrectAnswers}</div>
            <div className="stat-footer muted small">Review opportunities</div>
          </div>

          <div className="card stat-card">
            <div className="stat-card-head">
              <span className="stat-label">Unanswered</span>
              <div className="stat-icon-wrap icon-amber">
                <Clock size={18} aria-hidden="true" />
              </div>
            </div>
            <div className="stat-value">{attempt.unanswered}</div>
            <div className="stat-footer muted small">Skipped questions</div>
          </div>
        </section>

        {/* Action Buttons Bar */}
        <div className="result-actions-bar">
          {attempt.quizId && (
            <button
              className="btn primary"
              onClick={() => navigate(`/quiz/play/${attempt.quizId}`)}
            >
              <RotateCcw size={16} aria-hidden="true" />
              <span>Retake This Quiz</span>
            </button>
          )}

          <button
            className="btn secondary-quiz"
            onClick={() => navigate('/quiz')}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to QuizVerse</span>
          </button>

          <button
            className="btn ghost"
            onClick={() => navigate('/quiz/history')}
          >
            <History size={16} aria-hidden="true" />
            <span>View All History</span>
          </button>

          <button
            className="btn ghost"
            onClick={() => navigate('/study')}
            title="Schedule review tasks in StudyVerse"
          >
            <GraduationCap size={16} aria-hidden="true" />
            <span>Open StudyVerse</span>
          </button>
        </div>

        {/* Detailed Question Review & Explanations */}
        {questions.length > 0 && (
          <section className="card result-review-section">
            <header className="card-head">
              <div>
                <h2>Question Review & Explanations</h2>
                <p className="muted small">
                  Inspect your chosen answers and detailed rationales for every question
                </p>
              </div>
            </header>

            <div className="review-questions-list">
              {questions.map((q, idx) => {
                const userChoice = attempt.answers ? attempt.answers[q.id] : undefined;
                const isSkipped = userChoice === undefined;
                const isCorrect = !isSkipped && Number(userChoice) === Number(q.correctIndex);

                return (
                  <div
                    key={q.id || idx}
                    className={`review-question-card ${
                      isCorrect ? 'is-correct' : isSkipped ? 'is-skipped' : 'is-incorrect'
                    }`}
                  >
                    <div className="review-q-header">
                      <span className="review-q-num">Q{idx + 1}</span>
                      <div className="review-q-status">
                        {isCorrect && (
                          <span className="badge-status correct">
                            <CheckCircle2 size={13} aria-hidden="true" /> Correct
                          </span>
                        )}
                        {!isCorrect && !isSkipped && (
                          <span className="badge-status incorrect">
                            <XCircle size={13} aria-hidden="true" /> Incorrect
                          </span>
                        )}
                        {isSkipped && (
                          <span className="badge-status skipped">
                            <Clock size={13} aria-hidden="true" /> Skipped
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="review-q-text">{q.question}</h3>

                    {/* Options list showing user vs correct */}
                    <div className="review-options-list">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = Number(userChoice) === optIdx;
                        const isTheCorrect = Number(q.correctIndex) === optIdx;

                        let optClass = 'review-option-pill';
                        if (isTheCorrect) optClass += ' correct-option';
                        if (isChosen && !isTheCorrect) optClass += ' incorrect-chosen-option';

                        return (
                          <div key={optIdx} className={optClass}>
                            <span className="option-pill-letter">
                              {optionLetters[optIdx] || optIdx + 1}
                            </span>
                            <span className="option-pill-text">{opt}</span>
                            {isTheCorrect && (
                              <span className="option-pill-tag tag-correct">
                                Correct Answer
                              </span>
                            )}
                            {isChosen && !isTheCorrect && (
                              <span className="option-pill-tag tag-incorrect">
                                Your Answer
                              </span>
                            )}
                            {isChosen && isTheCorrect && (
                              <span className="option-pill-tag tag-both">
                                Your Answer (Correct)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Detailed Explanation */}
                    {q.explanation && (
                      <div className="review-explanation-box">
                        <div className="explanation-head">
                          <Info size={15} aria-hidden="true" />
                          <strong>Explanation</strong>
                        </div>
                        <p className="explanation-body">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
