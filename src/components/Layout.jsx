import { useState } from 'react';
import {
  BarChart3, Bot, CalendarDays, CalendarRange, Cloud, CloudOff, GraduationCap, LayoutDashboard, ListTodo,
  Loader2, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, PlusCircle, Settings as SettingsIcon, Sun, X,
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

function readCollapsed() {
  try {
    return localStorage.getItem('ssp:sidebar') === '1';
  } catch {
    return false;
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

export default function Layout({ page, navigate, children }) {
  const { user, signOut } = useAuth();
  const { settings, updateSettings, notice } = useStore();
  const { confirm } = useUI();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const current = NAV.find((n) => n.id === page) || NAV[0];

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('ssp:sidebar', c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const go = (id) => {
    navigate(id);
    setDrawer(false);
  };

  const onSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: user.mode === 'google' ? 'Your data is saved to your account. Sign back in with the same Google account to see it again.' : 'Guest data stays in this browser. You can continue as a guest again later.',
      confirmLabel: 'Sign out',
    });
    if (ok) signOut();
  };

  const dark = settings.theme === 'dark';

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      {drawer && <div className="overlay" onClick={() => setDrawer(false)} aria-hidden="true" />}
      <aside className={`sidebar ${drawer ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sb-brand">
          <div className="logo" aria-hidden="true">
            <GraduationCap size={22} />
          </div>
          <div className="sb-brand-text">
            <strong>Smart Study Planner</strong>
            <span>Plan Smart, Study Better</span>
          </div>
          <button className="icon-btn sb-close" aria-label="Close menu" onClick={() => setDrawer(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="sb-section">Navigation</div>
        <nav className="sb-nav">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.id === page;
            return (
              <button key={n.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => go(n.id)} aria-current={active ? 'page' : undefined} title={collapsed ? n.label : undefined}>
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

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" aria-label="Open menu" onClick={() => setDrawer(true)}>
            <Menu size={20} />
          </button>
          <button className="icon-btn desktop-only" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={toggleCollapsed}>
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <h1 className="topbar-title">{current.label}</h1>
          <div className="topbar-right">
            <SyncPill />
            <button className="icon-btn" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="avatar-btn" aria-label="Open settings" onClick={() => go('settings')}>
              <Avatar user={user} size={34} />
            </button>
          </div>
        </header>
        {notice && (
          <div className="banner warn" role="status">
            {notice}
          </div>
        )}
        <main className="content" id="content" key={page}>
          {children}
        </main>
      </div>
    </div>
  );
}
