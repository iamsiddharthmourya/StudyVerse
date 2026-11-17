import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  GraduationCap,
  HelpCircle,
  Moon,
  Sparkles,
  Sun,
  Timer,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../services/auth.jsx';
import { Avatar } from '../components/ui.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
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
    <div className="landing-wrap">
      {/* Top Navigation */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="logo" aria-hidden="true">
              <GraduationCap size={22} />
            </div>
            <div className="landing-brand-text">
              <strong>StudyVerse</strong>
              <span className="brand-dot">·</span>
              <span className="brand-sub">QuizVerse</span>
            </div>
          </div>

          <div className="landing-nav-actions">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Switch to dark teal mode' : 'Switch to clean light mode'}
              title={theme === 'light' ? 'Dark teal mode' : 'Light mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {user ? (
              <div className="landing-user-badge">
                <Avatar user={user} size={30} />
                <span className="landing-user-name">
                  {user.mode === 'guest' ? 'Guest' : (user.name || 'Student')}
                </span>
                <button
                  className="btn ghost sm"
                  onClick={() => signOut()}
                  title="Sign out"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                className="btn light sm"
                onClick={() => navigate('/study')}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-pill">
            <Sparkles size={14} className="landing-pill-icon" aria-hidden="true" />
            <span>Unified Student Learning Platform</span>
          </div>

          <h1 className="landing-title">Your Learning Space</h1>
          <p className="landing-tagline">Plan smarter. Practice better.</p>
          <p className="landing-desc">
            A single, synchronized workspace for intelligent study schedule planning and automated quiz mastery.
          </p>
        </section>

        {/* Dual Mode Cards */}
        <section className="landing-cards" aria-label="Learning Modes">
          {/* StudyVerse Card */}
          <article className="mode-card mode-card-study">
            <div className="mode-card-header">
              <div className="mode-icon mode-icon-study" aria-hidden="true">
                <GraduationCap size={28} />
              </div>
              <span className="mode-badge mode-badge-active">Active</span>
            </div>

            <div className="mode-card-body">
              <h2>StudyVerse</h2>
              <p className="mode-card-desc">
                Organize your studies, manage tasks, and track your academic progress.
              </p>

              <ul className="mode-features">
                <li>
                  <CalendarCheck size={16} aria-hidden="true" />
                  <span>Daily & weekly capacity workload planning</span>
                </li>
                <li>
                  <Timer size={16} aria-hidden="true" />
                  <span>Drift-proof timestamp Focus Timer</span>
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Deadline tracking & performance analytics</span>
                </li>
              </ul>
            </div>

            <div className="mode-card-foot">
              <button
                className="btn primary wide"
                onClick={() => navigate('/study')}
              >
                <span>Open StudyVerse</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </article>

          {/* QuizVerse Card */}
          <article className="mode-card mode-card-quiz">
            <div className="mode-card-header">
              <div className="mode-icon mode-icon-quiz" aria-hidden="true">
                <Sparkles size={28} />
              </div>
              <span className="mode-badge mode-badge-coming">Preview</span>
            </div>

            <div className="mode-card-body">
              <h2>QuizVerse</h2>
              <p className="mode-card-desc">
                Create quizzes from topics and study materials to test your knowledge.
              </p>

              <ul className="mode-features">
                <li>
                  <BookOpen size={16} aria-hidden="true" />
                  <span>Instant MCQ generation from topics or notes</span>
                </li>
                <li>
                  <HelpCircle size={16} aria-hidden="true" />
                  <span>Timed & untimed test attempt engine</span>
                </li>
                <li>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Explanations, scoring & attempt history</span>
                </li>
              </ul>
            </div>

            <div className="mode-card-foot">
              <button
                className="btn secondary-quiz wide"
                onClick={() => navigate('/quiz')}
              >
                <span>Explore QuizVerse</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </article>
        </section>

        {/* Feature Highlights Grid */}
        <section className="landing-highlights">
          <div className="highlight-item">
            <div className="highlight-icon">
              <CheckCircle2 size={20} aria-hidden="true" />
            </div>
            <div>
              <h3>Single Account & Shared Session</h3>
              <p>Move seamlessly between your study plan and quizzes without signing in twice.</p>
            </div>
          </div>

          <div className="highlight-item">
            <div className="highlight-icon">
              <UserCheck size={20} aria-hidden="true" />
            </div>
            <div>
              <h3>Offline Guest Mode</h3>
              <p>Work locally in your browser anytime with complete privacy and zero setup.</p>
            </div>
          </div>

          <div className="highlight-item">
            <div className="highlight-icon">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div>
              <h3>Dark Teal & Clean Light</h3>
              <p>Engineered for high readability and reduced eye strain during long study sessions.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-foot">
        <p>© 2026 StudyVerse + QuizVerse · Plan smarter. Practice better.</p>
      </footer>
    </div>
  );
}
