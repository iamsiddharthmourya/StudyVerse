import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { AuthProvider, useAuth } from './services/auth.jsx';
import { StoreProvider, useStore } from './state/store.jsx';
import { UIProvider } from './components/ui.jsx';
import { TaskEditorProvider } from './components/TaskEditor.jsx';
import Layout, { NAV } from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DailyTasks from './pages/DailyTasks.jsx';
import WeeklyPlan from './pages/WeeklyPlan.jsx';
import AddTask from './pages/AddTask.jsx';
import Exams from './pages/Exams.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import Analytics from './pages/Analytics.jsx';
import Assistant from './pages/Assistant.jsx';
import Settings from './pages/Settings.jsx';
import LandingPage from './pages/LandingPage.jsx';
import NotFound from './pages/NotFound.jsx';
import QuizDashboard from './quizverse/pages/QuizDashboard.jsx';
import QuizPlaceholder from './quizverse/pages/QuizPlaceholder.jsx';
import { QuizProvider } from './quizverse/state/QuizContext.jsx';

const PAGES = {
  dashboard: Dashboard,
  daily: DailyTasks,
  weekly: WeeklyPlan,
  add: AddTask,
  exams: Exams,
  calendar: CalendarPage,
  analytics: Analytics,
  assistant: Assistant,
  settings: Settings,
};

export function LoadingScreen({ text = 'Loading StudyVerse…', isExiting = false }) {
  return (
    <div
      className={`splash-screen ${isExiting ? 'splash-exiting' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={text}
    >
      <div className="splash-content">
        <div className="splash-logo-wrap">
          <div className="splash-logo" aria-hidden="true">
            <GraduationCap size={34} />
          </div>
          <div className="splash-glow" aria-hidden="true" />
        </div>
        <div className="splash-brand">
          <h1 className="splash-title">StudyVerse</h1>
          <p className="splash-subtitle">Smart Study Planner · QuizVerse</p>
        </div>
        <div className="splash-loader" aria-hidden="true">
          <div className="splash-loader-bar" />
        </div>
        <p className="splash-status">{text}</p>
      </div>
    </div>
  );
}

function StudyVerseShell() {
  const { ready } = useStore();
  const navigateRouter = useNavigate();
  const { section } = useParams();
  const [showSplash, setShowSplash] = useState(!ready);
  const [isExiting, setIsExiting] = useState(false);

  // Validate active section; default to 'dashboard'
  const activePage = section && PAGES[section] ? section : 'dashboard';

  useEffect(() => {
    if (ready && showSplash) {
      setIsExiting(true);
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [ready, showSplash]);

  // Safety fallback for loading screen
  useEffect(() => {
    if (!showSplash) return undefined;
    const safety = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => setShowSplash(false), 260);
    }, 4500);
    return () => clearTimeout(safety);
  }, [showSplash]);

  const navigateStudy = useCallback(
    (id) => {
      if (id === 'dashboard') {
        navigateRouter('/study');
      } else {
        navigateRouter(`/study/${id}`);
      }
      window.scrollTo({ top: 0 });
    },
    [navigateRouter],
  );

  const Page = PAGES[activePage] || Dashboard;

  return (
    <TaskEditorProvider>
      <Layout
        page={activePage}
        navigate={navigateStudy}
        onSwitchMode={(path) => navigateRouter(path)}
      >
        <div className="page-transition" key={activePage}>
          <Page navigate={navigateStudy} />
        </div>
      </Layout>
      {showSplash && (
        <LoadingScreen text="Syncing your planner…" isExiting={isExiting} />
      )}
    </TaskEditorProvider>
  );
}

function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [showAuthSplash, setShowAuthSplash] = useState(loading);
  const [isAuthExiting, setIsAuthExiting] = useState(false);

  useEffect(() => {
    if (!loading && showAuthSplash && !user) {
      setIsAuthExiting(true);
      const timer = setTimeout(() => {
        setShowAuthSplash(false);
      }, 260);
      return () => clearTimeout(timer);
    }
    if (!loading && user) {
      setShowAuthSplash(false);
    }
  }, [loading, showAuthSplash, user]);

  useEffect(() => {
    if (!showAuthSplash) return undefined;
    const safety = setTimeout(() => {
      setIsAuthExiting(true);
      setTimeout(() => setShowAuthSplash(false), 260);
    }, 4500);
    return () => clearTimeout(safety);
  }, [showAuthSplash]);

  if (showAuthSplash && !user) {
    return (
      <>
        <Login />
        <LoadingScreen text="Starting StudyVerse…" isExiting={isAuthExiting} />
      </>
    );
  }

  if (!user) return <Login />;

  return children(user);
}

function LegacyHashRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash && PAGES[hash]) {
      window.location.hash = '';
      navigate(hash === 'dashboard' ? '/study' : `/study/${hash}`, { replace: true });
    }
  }, [navigate, location]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <LegacyHashRedirect />
      <Routes>
        {/* Minimal Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* StudyVerse Application */}
        <Route
          path="/study"
          element={
            <AuthGate>
              {(user) => (
                <StoreProvider key={`${user.mode}:${user.uid}`} user={user}>
                  <StudyVerseShell />
                </StoreProvider>
              )}
            </AuthGate>
          }
        />
        <Route
          path="/study/:section"
          element={
            <AuthGate>
              {(user) => (
                <StoreProvider key={`${user.mode}:${user.uid}`} user={user}>
                  <StudyVerseShell />
                </StoreProvider>
              )}
            </AuthGate>
          }
        />

        {/* QuizVerse Module */}
        <Route
          path="/quiz"
          element={
            <AuthGate>
              {(user) => (
                <QuizProvider key={`${user.mode}:${user.uid}`}>
                  <QuizDashboard />
                </QuizProvider>
              )}
            </AuthGate>
          }
        />
        <Route
          path="/quiz/create"
          element={
            <AuthGate>
              {(user) => (
                <QuizProvider key={`${user.mode}:${user.uid}`}>
                  <QuizPlaceholder type="create" />
                </QuizProvider>
              )}
            </AuthGate>
          }
        />
        <Route
          path="/quiz/play/:quizId"
          element={
            <AuthGate>
              {(user) => (
                <QuizProvider key={`${user.mode}:${user.uid}`}>
                  <QuizPlaceholder type="play" />
                </QuizProvider>
              )}
            </AuthGate>
          }
        />
        <Route
          path="/quiz/result/:attemptId"
          element={
            <AuthGate>
              {(user) => (
                <QuizProvider key={`${user.mode}:${user.uid}`}>
                  <QuizPlaceholder type="result" />
                </QuizProvider>
              )}
            </AuthGate>
          }
        />
        <Route
          path="/quiz/history"
          element={
            <AuthGate>
              {(user) => (
                <QuizProvider key={`${user.mode}:${user.uid}`}>
                  <QuizPlaceholder type="history" />
                </QuizProvider>
              )}
            </AuthGate>
          }
        />

        {/* 404 Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <UIProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </UIProvider>
    </AuthProvider>
  );
}
