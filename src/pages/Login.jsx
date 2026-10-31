import { AlertTriangle, BarChart3, Bot, CalendarCheck, GraduationCap, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../services/auth.jsx';

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const FEATURES = [
  { icon: CalendarCheck, text: 'Daily and weekly plans with deadline tracking' },
  { icon: GraduationCap, text: 'Exam and assignment countdowns' },
  { icon: BarChart3, text: 'Analytics built from your real task data' },
  { icon: Bot, text: 'A study assistant that builds plans from your tasks' },
];

export default function Login() {
  const { signInWithGoogle, continueAsGuest, busy, error, googleConfigured } = useAuth();
  return (
    <div className="login">
      <section className="login-hero">
        <div className="logo big" aria-hidden="true">
          <GraduationCap size={30} />
        </div>
        <h1>Smart Study Planner</h1>
        <p className="tagline">Plan Smart, Study Better</p>
        <ul className="login-features">
          {FEATURES.map((f) => (
            <li key={f.text}>
              <f.icon size={18} aria-hidden="true" /> {f.text}
            </li>
          ))}
        </ul>
        <p className="login-foot">Built for the Intra College Project Expo 2026</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>Welcome</h2>
          <p className="muted">Sign in with your Google account so your tasks and settings are saved to <strong>your own account</strong> and are there whenever you come back.</p>

          <button className="btn google" onClick={signInWithGoogle} disabled={busy}>
            {busy ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <GoogleG />}
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>

          {error && (
            <p className="form-error" role="alert">
              <AlertTriangle size={14} aria-hidden="true" /> {error}
            </p>
          )}

          <div className="or">
            <span>or</span>
          </div>

          <button className="btn ghost wide" onClick={continueAsGuest}>
            <UserRound size={17} aria-hidden="true" /> Continue as guest
          </button>
          <p className="hint center-text">Guest data is stored only in this browser and is not tied to an account.</p>

          {!googleConfigured && (
            <div className="banner warn small-banner">
              <strong>Setup needed for Google sign-in.</strong> Add your Firebase keys to the <code>.env</code> file (see README.md). Until then, use guest mode.
            </div>
          )}

          <p className="privacy">
            <ShieldCheck size={14} aria-hidden="true" /> We only read your name, email and profile picture. Each account can only access its own data.
          </p>
        </div>
      </section>
    </div>
  );
}
