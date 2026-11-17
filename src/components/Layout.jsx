import { useEffect, useState } from 'react';
import {
  BarChart3, Bot, CalendarDays, CalendarRange, Cloud, CloudOff,
  EyeOff, GraduationCap, LayoutDashboard, ListTodo, Loader2, LogOut, Menu, Moon,
  PanelLeftClose, PanelLeftOpen, PlusCircle, Settings as SettingsIcon, Sparkles, Sun, X,
} from 'lucide-react';
import { Avatar, useUI } from './ui.jsx';
import { useAuth } from '../services/auth.jsx';
import { useStore } from '../state/store.jsx';

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', sub: 'Overview and progress', icon: LayoutDashboard },
  { id: 'daily', label: 'Daily Tasks', sub: 'Your to-do list', icon: ListTodo },
  { id: 'weekly', label: 'Weekly Plan', sub: 'Mon–Sun workload', icon: CalendarRange },
  { id: 'add', label: 'Add Task', sub: 'Create a new task', icon: PlusCircle },
  { id: 'exams', label: 'Exams & Assignments', sub: 'Deadlines and countdowns', icon: GraduationCap },
  { id: 'calendar', label: 'Calendar', sub: 'Month and week view', icon: CalendarDays },
  { id: 'analytics', label: 'Performance Analytics', sub: 'Task completion insights', icon: BarChart3 },
  { id: 'assistant', label: 'AI Study Assistant', sub: 'Plans and revision help', icon: Bot, tag: 'Demo' },
  { id: 'settings', label: 'Settings', sub: 'Profile and preferences', icon: SettingsIcon },
];

function readSidebarState() {
  try {
    const s = localStorage.getItem('ssp:sidebar-state');
    if (s === 'expanded' || s === 'compact' || s === 'hidden') return s;
    if (localStorage.getItem('ssp:sidebar') === '1') return 'compact';
    return 'expanded';
  } catch {
    return 'expanded';
  }
}

function readLastVisibleState() {
  try {
    const s = localStorage.getItem('ssp:sidebar-last-visible');
    if (s === 'expanded' || s === 'compact') return s;
    return 'expanded';
  } catch {
    return 'expanded';
  }
}

function SyncPill() {
  const { saveStatus, retrySave, user } = useStore();
  if (saveStatus === 'saving') {
    return (
      <span className="pill" role="status">
        <Loader2 size={14} className="spin" aria-hidden="true" /> Saving…
      </span>
    );
  }
  if (saveStatus === 'error') {
    return (
      <button className="pill pill-warn" onClick={retrySave} title="Click to try saving again">
        <CloudOff size={14} aria-hidden="true" /> Not saved — retry
      </button>
    );
  }
  return (
    <span className="pill" role="status" title={user.mode === 'google' ? 'Saved to your Google account' : 'Saved in this browser only'}>
      <Cloud size={14} aria-hidden="true" /> {user.mode === 'google' ? 'Synced' : 'Saved on this device'}
    </span>
  );
}

export default function Layout({ page, navigate, onSwitchMode, children }) {
  const { user, signOut } = useAuth();
  const { settings, updateSettings, notice } = useStore();
  const { confirm } = useUI();
  const [sidebarState, setSidebarState] = useState(readSidebarState);
  const [lastVisible, setLastVisible] = useState(readLastVisibleState);
  const [drawer, setDrawer] = useState(false);
  const current = NAV.find((n) => n.id === page) || NAV[0];

  // Mobile drawer: handle Escape key and prevent background scroll
  useEffect(() => {
    if (!drawer) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [drawer]);

  // Sidebar Controls:
  // 1. Expand / Compact Toggle
  const toggleCompact = () => {
    setSidebarState((curr) => {
      const next = curr === 'compact' ? 'expanded' : 'compact';
      try {
        localStorage.setItem('ssp:sidebar-state', next);
        localStorage.setItem('ssp:sidebar-last-visible', next);
      } catch {
        /* ignore */
      }
      setLastVisible(next);
      return next;
    });
  };

  // 2. Hide / Show Toggle
  const hideSidebar = () => {
    setSidebarState((curr) => {
      if (curr === 'expanded' || curr === 'compact') {
        try {
          localStorage.setItem('ssp:sidebar-last-visible', curr);
        } catch {
          /* ignore */
        }
        setLastVisible(curr);
      }
      try {
        localStorage.setItem('ssp:sidebar-state', 'hidden');
      } catch {
        /* ignore */
      }
      return 'hidden';
    });
  };

  const showSidebar = () => {
    const restoreTo = lastVisible === 'compact' ? 'compact' : 'expanded';
    try {
      localStorage.setItem('ssp:sidebar-state', restoreTo);
    } catch {
      /* ignore */
    }
    setSidebarState(restoreTo);
  };

  const go = (id) => {
    navigate(id);
    setDrawer(false);
  };

  const onSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: user.mode === 'google'
        ? 'Your data is saved to your account. Sign back in with the same Google account to see it again.'
        : 'Guest data stays in this browser. You can continue as a guest again later.',
      confirmLabel: 'Sign out',
    });
    if (ok) signOut();
  };

  const dark = settings.theme === 'dark';
  const isCompact = sidebarState === 'compact';
  const isHidden = sidebarState === 'hidden';

  return (
    <div className={`app state-${sidebarState} ${isCompact ? 'collapsed' : ''} ${isHidden ? 'hidden' : ''}`}>
      {drawer && <div className="overlay" onClick={() => setDrawer(false)} aria-hidden="true" />}

      {/* Main navigation sidebar */}
      <aside
        className={`sidebar ${drawer ? 'open' : ''} ${isCompact ? 'is-compact' : ''} ${isHidden ? 'is-hidden' : ''}`}
        aria-label="Main navigation"
      >
        <div className="sb-brand">
          <button
            className="logo-home-btn"
            onClick={() => (onSwitchMode ? onSwitchMode('/') : navigate('/'))}
            title="Platform Home"
            aria-label="Platform Home"
          >
            <div className="logo" aria-hidden="true">
              <GraduationCap size={22} />
            </div>
          </button>
          <div className="sb-brand-text">
            <strong>StudyVerse</strong>
            <span>Smart Study Planner</span>
          </div>

          <div className="sb-header-actions desktop-only">
            <button
              className="icon-btn sm"
              aria-label="Hide sidebar"
              title="Hide sidebar"
              onClick={hideSidebar}
            >
              <EyeOff size={16} />
            </button>
          </div>

          <button className="icon-btn sb-close mobile-only" aria-label="Close menu" onClick={() => setDrawer(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="sb-section">Navigation</div>
        <nav className="sb-nav">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.id === page;
            return (
              <button
                key={n.id}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => go(n.id)}
                aria-current={active ? 'page' : undefined}
                title={isCompact ? n.label : undefined}
                data-tooltip={n.label}
              >
                <span className="nav-icon">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="nav-text">
                  <strong>{n.label}</strong>
                  <small>{n.sub}</small>
                </span>
                {n.tag && <span className="nav-tag">{n.tag}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sb-foot">
          <button className="user-card" onClick={() => go('settings')} title="Open settings">
            <Avatar user={user} size={36} />
            <span className="user-text">
              <strong>{settings.name || user.name}</strong>
              <small>{user.email || 'Guest · this browser only'}</small>
            </span>
          </button>
          <button className="icon-btn light" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="main">
        <header className="topbar">
          {/* Mobile hamburger */}
          <button className="icon-btn mobile-only" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Menu size={20} />
          </button>

          {/* Desktop Show Sidebar button (when hidden) */}
          {isHidden && (
            <button
              className="btn ghost sm show-sidebar-btn desktop-only"
              aria-label="Show sidebar"
              title="Restore sidebar navigation"
              onClick={showSidebar}
            >
              <PanelLeftOpen size={18} aria-hidden="true" />
              <span>Show Sidebar</span>
            </button>
          )}

          {/* Desktop Controls (when sidebar is visible) */}
          {!isHidden && (
            <div className="sidebar-topbar-controls desktop-only">
              <button
                className="icon-btn"
                aria-label={isCompact ? 'Expand sidebar' : 'Compact sidebar'}
                title={isCompact ? 'Expand sidebar' : 'Compact sidebar'}
                onClick={toggleCompact}
              >
                {isCompact ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
              </button>
              <button
                className="icon-btn"
                aria-label="Hide sidebar"
                title="Hide sidebar"
                onClick={hideSidebar}
              >
                <EyeOff size={18} />
              </button>
            </div>
          )}

          <h1 className="topbar-title">{current.label}</h1>

          <div className="topbar-right">
            <button
              className="btn secondary-quiz sm"
              onClick={() => (onSwitchMode ? onSwitchMode('/quiz') : navigate('/quiz'))}
              title="Switch to QuizVerse platform"
            >
              <Sparkles size={14} aria-hidden="true" />
              <span>QuizVerse</span>
            </button>
            <SyncPill />
            <button
              className="icon-btn"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="avatar-btn" aria-label="Open settings" title="Open settings" onClick={() => go('settings')}>
              <Avatar user={user} size={34} />
            </button>
          </div>
        </header>

        {notice && (
          <div className="banner warn" role="status">
            {notice}
          </div>
        )}

        <main className="content" id="content">
          <div key={page} className="page-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
