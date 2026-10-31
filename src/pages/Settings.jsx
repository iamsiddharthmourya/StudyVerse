import { useEffect, useState } from 'react';
import { Download, LogOut, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { useAuth } from '../services/auth.jsx';
import { Avatar, Card, Field, PageHeader, useUI } from '../components/ui.jsx';

function check(v) {
  const e = {};
  if ((v.name || '').length > 40) e.name = 'Keep your name under 40 characters.';
  if (!(v.course || '').trim()) e.course = 'Enter your course.';
  const range = (key, lo, hi, label) => {
    const n = Number(v[key]);
    if (v[key] === '' || !Number.isFinite(n) || !Number.isInteger(n)) e[key] = `${label} must be a whole number.`;
    else if (n < lo || n > hi) e[key] = `${label} must be between ${lo} and ${hi}.`;
  };
  range('dailyMinutes', 15, 960, 'Daily study time');
  range('sessionMinutes', 10, 120, 'Session length');
  range('breakMinutes', 1, 60, 'Break length');
  range('weeklyGoalPct', 10, 100, 'Weekly target');
  return e;
}

export default function Settings() {
  const { settings, tasks, goals, updateSettings, clearDemo, clearAll, resetToDemo, saveStatus } = useStore();
  const { user, signOut } = useAuth();
  const { toast, confirm } = useUI();
  const [v, setV] = useState({ ...settings });
  const [errors, setErrors] = useState({});

  // Keep the theme field in step when it is changed from the top bar.
  useEffect(() => {
    setV((s) => ({ ...s, theme: settings.theme }));
  }, [settings.theme]);

  const set =(k) => (e) => {
    setV((s) => ({ ...s, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const save = (e) => {
    e.preventDefault();
    const found = check(v);
    setErrors(found);
    if (Object.keys(found).length) {
      toast('Please fix the highlighted settings.', 'error');
      return;
    }
    updateSettings({
      name: (v.name || '').trim(),
      course: v.course.trim(),
      dailyMinutes: Number(v.dailyMinutes),
      sessionMinutes: Number(v.sessionMinutes),
      breakMinutes: Number(v.breakMinutes),
      weeklyGoalPct: Number(v.weeklyGoalPct),
      theme: v.theme,
    });
    toast('Settings saved.');
  };

  const run = async (opts, action, done) => {
    if (await confirm(opts)) {
      action();
      toast(done, 'info');
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings, tasks, goals }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart-study-planner-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const input = (id, label, props = {}, hint) => (
    <Field label={label} htmlFor={`s-${id}`} error={errors[id]} hint={hint}>
      <input id={`s-${id}`} className="input" value={v[id] ?? ''} onChange={set(id)} aria-invalid={!!errors[id]} {...props} />
    </Field>
  );

  return (
    <div className="stack-lg">
      <PageHeader title="Settings" subtitle="Your profile, study preferences and data." />

      <div className="grid g2">
        <Card title="Account">
          <div className="account">
            <Avatar user={user} size={56} />
            <div>
              <strong>{user.mode === 'google' ? user.name : 'Guest'}</strong>
              <div className="muted small">{user.email || 'Not signed in with Google'}</div>
              <div className="muted small">
                {user.mode === 'google'
                  ? saveStatus === 'error'
                    ? 'Your latest changes are not saved to the cloud yet.'
                    : 'Your data is saved to your Google account and follows you to any device.'
                  : 'Guest data is stored in this browser only. Sign in with Google to keep it on your account.'}
              </div>
            </div>
          </div>
          <button className="btn ghost mt" onClick={async () => (await confirm({ title: 'Sign out?', message: 'You can sign back in at any time.', confirmLabel: 'Sign out' })) && signOut()}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </Card>

        <Card title="Your data">
          <p className="muted small">
            {tasks.length} task{tasks.length === 1 ? '' : 's'} · {tasks.filter((t) => t.demo).length} demo
          </p>
          <div className="stack">
            <button className="btn ghost wide" onClick={exportData}>
              <Download size={16} aria-hidden="true" /> Download my data (JSON)
            </button>
            <button
              className="btn ghost wide"
              onClick={() =>
                run(
                  { title: 'Reset to demo data?', message: 'All your current tasks and goals will be replaced with the sample data. This cannot be undone.', confirmLabel: 'Reset to demo data', danger: true },
                  resetToDemo,
                  'Demo data restored.',
                )
              }
            >
              <RotateCcw size={16} aria-hidden="true" /> Reset to demo data
            </button>
            <button
              className="btn ghost wide"
              onClick={() => run({ title: 'Remove demo data?', message: 'Only the sample tasks and goals are deleted. Your own tasks are kept.', confirmLabel: 'Remove demo data', danger: true }, clearDemo, 'Demo data removed.')}
              disabled={!tasks.some((t) => t.demo) && !goals.some((g) => g.demo)}
            >
              <Trash2 size={16} aria-hidden="true" /> Remove demo data only
            </button>
            <button
              className="btn danger wide"
              onClick={() => run({ title: 'Delete ALL tasks and goals?', message: 'Every task and weekly goal will be permanently deleted. Your settings are kept. This cannot be undone.', confirmLabel: 'Delete everything', danger: true }, clearAll, 'All tasks deleted.')}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete all tasks
            </button>
          </div>
        </Card>
      </div>

      <Card title="Profile & study preferences">
        <form onSubmit={save} noValidate>
          <div className="form-grid">
            {input('name', 'Student name', { maxLength: 40, placeholder: 'Your first name' })}
            {input('course', 'Course', { maxLength: 60, placeholder: 'e.g. B.Tech CSE (AIML)' })}
            {input('dailyMinutes', 'Daily available study time (minutes)', { type: 'number', min: 15, max: 960, step: 15, inputMode: 'numeric' }, 'Used for study plans')}
            {input('sessionMinutes', 'Preferred study session (minutes)', { type: 'number', min: 10, max: 120, step: 5, inputMode: 'numeric' }, 'Also the focus timer length')}
            {input('breakMinutes', 'Break duration (minutes)', { type: 'number', min: 1, max: 60, inputMode: 'numeric' })}
            {input('weeklyGoalPct', 'Weekly completion target (%)', { type: 'number', min: 10, max: 100, step: 5, inputMode: 'numeric' }, 'Shown on the Weekly Plan')}
            <Field label="Theme" htmlFor="s-theme">
              <select id="s-theme" className="input" value={v.theme} onChange={set('theme')}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit">
              <Save size={16} aria-hidden="true" /> Save settings
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
