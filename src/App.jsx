import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

const fromHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return NAV.some((n) => n.id === id) ? id : 'dashboard';
};

function usePage() {
  const [page, setPage] = useState(fromHash);
  useEffect(() => {
    const onHash = () => setPage(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((id) => {
    window.location.hash = `/${id}`;
    window.scrollTo({ top: 0 });
  }, []);
  return [page, navigate];
}

function Splash({ text }) {
  return (
    <div className="splash" role="status">
      <Loader2 size={30} className="spin" aria-hidden="true" />
      <p>{text}</p>
    </div>
  );
}

function Planner() {
  const { ready } = useStore();
  const [page, navigate] = usePage();
  if (!ready) return <Splash text="Loading your planner…" />;
  const Page = PAGES[page] || Dashboard;
  return (
    <TaskEditorProvider>
      <Layout page={page} navigate={navigate}>
        <Page navigate={navigate} />
      </Layout>
    </TaskEditorProvider>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <Splash text="Starting…" />;
  if (!user) return <Login />;
  // `key` makes sure a different account never sees the previous account's state.
  return (
    <StoreProvider key={`${user.mode}:${user.uid}`} user={user}>
      <UIProvider>
        <Planner />
      </UIProvider>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
