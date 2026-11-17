import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  History,
  Home,
  Moon,
  Play,
  Sparkles,
  Sun,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../services/auth.jsx';
import { Avatar } from '../../components/ui.jsx';

export default function QuizDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ssp:theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ssp:theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="quiz-shell">
      {/* QuizVerse Top Navigation */}
      <header className="quiz-topbar">
        <div className="quiz-topbar-inner">
          <div className="quiz-brand">
            <button
              className="quiz-logo-btn"
              onClick={() => navigate('/')}
              title="Return to Home"
            >
              <div className="quiz-logo-icon" aria-hidden="true">
                <Sparkles size={20} />
              </div>
              <div className="quiz-brand-title">
                <strong>QuizVerse</strong>
                <span>AI Practice Platform</span>
              </div>
            </button>
          </div>

          <div className="quiz-topbar-actions">
            {/* Mode Switcher to StudyVerse */}
            <button
              className="btn primary sm"
              onClick={() => navigate('/study')}
              title="Switch to StudyVerse Study Planner"
            >
              <GraduationCap size={15} aria-hidden="true" />
              <span>Switch to StudyVerse</span>
            </button>

            <button
              className="icon-btn"
              onClick={() => navigate('/')}
              title="Return to Home"
              aria-label="Home"
            >
              <Home size={18} />
            </button>

            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark teal mode' : 'Switch to clean light mode'}
              title={theme === 'light' ? 'Dark teal mode' : 'Light mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {user && (
              <div className="quiz-user-pill" title={user.email || 'Guest Mode'}>
                <Avatar user={user} size={28} />
                <span className="quiz-user-name">
                  {user.mode === 'guest' ? 'Guest' : (user.name || 'Student')}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Quiz Dashboard Content */}
      <main className="quiz-main">
        {/* Hero Section */}
        <section className="quiz-hero-card">
          <div className="quiz-hero-content">
            <div className="landing-pill">
              <Sparkles size={14} className="landing-pill-icon" aria-hidden="true" />
              <span>Phase 2 Architecture Active</span>
            </div>
            <h1>QuizVerse Dashboard</h1>
            <p className="muted">
              Create AI-generated practice quizzes, test yourself with timed attempts, and review detailed explanations.
            </p>
          </div>
          <div className="quiz-hero-action">
            <button
              className="btn primary"
              onClick={() => navigate('/quiz/create')}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>Create Quiz</span>
            </button>
          </div>
        </section>

        {/* Action Routes Grid */}
        <section className="quiz-actions-grid" aria-label="QuizVerse Navigation">
          <div className="card quiz-card" onClick={() => navigate('/quiz/create')}>
            <div className="quiz-card-head">
              <div className="quiz-card-icon icon-create">
                <Sparkles size={22} aria-hidden="true" />
              </div>
              <span className="quiz-badge">Create</span>
            </div>
            <h3>Create a Quiz</h3>
            <p className="muted small">
              Generate MCQs from any subject topic or upload notes in PDF, DOCX, or TXT format.
            </p>
            <div className="quiz-card-foot">
              <span>Open Creator</span>
              <ArrowRight size={14} aria-hidden="true" />
            </div>
          </div>

          <div className="card quiz-card" onClick={() => navigate('/quiz/play/demo-quiz')}>
            <div className="quiz-card-head">
              <div className="quiz-card-icon icon-play">
                <Play size={22} aria-hidden="true" />
              </div>
              <span className="quiz-badge">Play</span>
            </div>
            <h3>Quiz Player</h3>
            <p className="muted small">
              Test your knowledge with an interactive timed or untimed testing engine.
            </p>
            <div className="quiz-card-foot">
              <span>Open Player</span>
              <ArrowRight size={14} aria-hidden="true" />
            </div>
          </div>

          <div className="card quiz-card" onClick={() => navigate('/quiz/result/demo-attempt')}>
            <div className="quiz-card-head">
              <div className="quiz-card-icon icon-result">
                <Trophy size={22} aria-hidden="true" />
              </div>
              <span className="quiz-badge">Results</span>
            </div>
            <h3>Results & Explanations</h3>
            <p className="muted small">
              Inspect answer explanations, track score percentages, and target weak areas.
            </p>
            <div className="quiz-card-foot">
              <span>View Results</span>
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
              Review all past attempts, track completion trends, and re-attempt previous quizzes.
            </p>
            <div className="quiz-card-foot">
              <span>View History</span>
              <ArrowRight size={14} aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* Roadmap Preview */}
        <section className="card quiz-roadmap-card">
          <header className="card-head">
            <div>
              <h2>QuizVerse Roadmap & Planned Architecture</h2>
              <p className="muted small">Phased implementation roadmap for the QuizVerse platform</p>
            </div>
          </header>
          <div className="quiz-roadmap-list">
            <div className="roadmap-item done">
              <CheckCircle2 size={18} className="roadmap-check" aria-hidden="true" />
              <div>
                <strong>Phase 1: Architecture Audit</strong>
                <p className="muted small">Completed. Verified 100% data safety, shared auth, and design system.</p>
              </div>
            </div>
            <div className="roadmap-item active">
              <Sparkles size={18} className="roadmap-icon-active" aria-hidden="true" />
              <div>
                <strong>Phase 2: Routing Infrastructure & Dual Landing Page</strong>
                <p className="muted small">Active. React Router v6, `/study` nesting, and `/quiz` entry routes.</p>
              </div>
            </div>
            <div className="roadmap-item">
              <FileText size={18} className="roadmap-icon-pending" aria-hidden="true" />
              <div>
                <strong>Phase 3: Quiz Data Architecture & Store</strong>
                <p className="muted small">Subcollection persistence (`/users/{'{uid}'}/quizzes`) and guest local storage.</p>
              </div>
            </div>
            <div className="roadmap-item">
              <BookOpen size={18} className="roadmap-icon-pending" aria-hidden="true" />
              <div>
                <strong>Phase 4 & 5: AI Quiz Creator & Document Extraction</strong>
                <p className="muted small">PDF, DOCX, TXT parsing and secure Vercel Gemini serverless proxy.</p>
              </div>
            </div>
            <div className="roadmap-item">
              <Trophy size={18} className="roadmap-icon-pending" aria-hidden="true" />
              <div>
                <strong>Phase 6 & 7: Quiz Player, Timer & Results Analytics</strong>
                <p className="muted small">Interactive test engine, drift-proof timer, and Recharts performance curves.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
