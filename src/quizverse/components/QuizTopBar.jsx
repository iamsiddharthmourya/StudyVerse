import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  GraduationCap,
  History,
  Home,
  Moon,
  PlusCircle,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useAuth } from '../../services/auth.jsx';
import { Avatar } from '../../components/ui.jsx';

export default function QuizTopBar({ title, subtitle }) {
  const navigate = useNavigate();
  const location = useLocation();
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

  const isActive = (path) => location.pathname === path;

  return (
    <header className="quiz-topbar">
      <div className="quiz-topbar-inner">
        <div className="quiz-brand-section">
          <button
            className="quiz-logo-btn"
            onClick={() => navigate('/quiz')}
            title="QuizVerse Home"
          >
            <div className="quiz-logo-icon" aria-hidden="true">
              <Sparkles size={20} />
            </div>
            <div className="quiz-brand-title">
              <strong>QuizVerse</strong>
              <span>AI Practice Platform</span>
            </div>
          </button>

          {/* Quick Quiz Navigation Links */}
          <nav className="quiz-nav-links desktop-only" aria-label="Quiz Navigation">
            <button
              className={`quiz-nav-link ${isActive('/quiz') ? 'active' : ''}`}
              onClick={() => navigate('/quiz')}
            >
              Dashboard
            </button>
            <button
              className={`quiz-nav-link ${isActive('/quiz/create') ? 'active' : ''}`}
              onClick={() => navigate('/quiz/create')}
            >
              <PlusCircle size={14} aria-hidden="true" />
              <span>Create Quiz</span>
            </button>
            <button
              className={`quiz-nav-link ${isActive('/quiz/history') ? 'active' : ''}`}
              onClick={() => navigate('/quiz/history')}
            >
              <History size={14} aria-hidden="true" />
              <span>History</span>
            </button>
          </nav>
        </div>

        <div className="quiz-topbar-actions">
          {/* Switch to StudyVerse */}
          <button
            className="btn primary sm switch-mode-btn"
            onClick={() => navigate('/study')}
            title="Switch to StudyVerse Study Planner"
          >
            <GraduationCap size={15} aria-hidden="true" />
            <span>Switch to StudyVerse</span>
          </button>

          <button
            className="icon-btn"
            onClick={() => navigate('/')}
            title="Return to Platform Landing Page"
            aria-label="Platform Home"
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
  );
}
