import { useState } from 'react';
import { Save } from 'lucide-react';
import { Field } from './ui.jsx';
import { DIFFICULTIES, PRIORITIES, TYPES } from '../utils/constants.js';
import { todayStr } from '../utils/dates.js';
import { validateTask } from '../utils/validation.js';
import { useStore } from '../state/store.jsx';

const LABELS = {
  daily: { title: 'Task title', notes: 'Description or notes', ph: 'e.g. Revise backpropagation' },
  weekly: { title: 'Task title', notes: 'Description or notes', ph: 'e.g. Implement linear regression' },
  assignment: { title: 'Assignment name', notes: 'Notes', ph: 'e.g. DBMS Assignment 2' },
  exam: { title: 'Exam name', notes: 'Syllabus / topics to revise (separate with commas)', ph: 'e.g. Data Structures Mid-Sem' },
};

export function blankValues(defaults = {}) {
  return {
    title: '',
    subject: '',
    type: 'daily',
    notes: '',
    goal: '',
    startDate: '',
    dueDate: todayStr(),
    dueTime: '18:00',
    priority: 'Medium',
    difficulty: 'Medium',
    duration: 45,
    ...defaults,
  };
}

export default function TaskForm({ initial, lockType = false, submitLabel = 'Save task', onSubmit, onCancel }) {
  const { tasks } = useStore();
  const [v, setV] = useState(() => blankValues(initial));
  const [errors, setErrors] = useState({});
  const subjects = [...new Set(tasks.map((t) => t.subject))].sort();
  const L = LABELS[v.type] || LABELS.daily;

  const set = (key) => (e) => {
    const value = e.target.value;
    setV((s) => ({ ...s, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const found = validateTask(v);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document.getElementById(`f-${first}`)?.focus();
      return;
    }
    onSubmit(v);
  };

  const describe = (k) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `f-${k}-err` } : {});

  return (
    <form className="task-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field label="Task type" htmlFor="f-type" required error={errors.type}>
          <select id="f-type" className="input" value={v.type} onChange={set('type')} disabled={lockType}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Subject" htmlFor="f-subject" required error={errors.subject}>
          <input id="f-subject" className="input" list="subject-list" value={v.subject} onChange={set('subject')} placeholder="e.g. Machine Learning" maxLength={60} {...describe('subject')} />
          <datalist id="subject-list">
            {subjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>

        <div className="span-2">
          <Field label={L.title} htmlFor="f-title" required error={errors.title}>
            <input id="f-title" className="input" value={v.title} onChange={set('title')} placeholder={L.ph} maxLength={100} {...describe('title')} />
          </Field>
        </div>

        <Field label="Start date" htmlFor="f-startDate" hint="Optional" error={errors.startDate}>
          <input id="f-startDate" type="date" className="input" value={v.startDate} onChange={set('startDate')} {...describe('startDate')} />
        </Field>

        <div className="two-col">
          <Field label="Due date" htmlFor="f-dueDate" required error={errors.dueDate}>
            <input id="f-dueDate" type="date" className="input" value={v.dueDate} onChange={set('dueDate')} {...describe('dueDate')} />
          </Field>
          <Field label="Due time" htmlFor="f-dueTime" required error={errors.dueTime}>
            <input id="f-dueTime" type="time" className="input" value={v.dueTime} onChange={set('dueTime')} {...describe('dueTime')} />
          </Field>
        </div>

        <Field label="Priority" htmlFor="f-priority" required error={errors.priority}>
          <select id="f-priority" className="input" value={v.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>

        <Field label="Difficulty" htmlFor="f-difficulty" required error={errors.difficulty}>
          <select id="f-difficulty" className="input" value={v.difficulty} onChange={set('difficulty')}>
            {DIFFICULTIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>

        <Field label={v.type === 'exam' ? 'Exam length (minutes)' : 'Estimated duration (minutes)'} htmlFor="f-duration" required error={errors.duration} hint="Between 5 and 720">
          <input id="f-duration" type="number" inputMode="numeric" min="5" max="720" step="5" className="input" value={v.duration} onChange={set('duration')} {...describe('duration')} />
        </Field>

        <Field label="Study goal or chapter" htmlFor="f-goal" hint="Optional" error={errors.goal}>
          <input id="f-goal" className="input" value={v.goal} onChange={set('goal')} placeholder="e.g. Unit 3: Neural Networks" maxLength={100} {...describe('goal')} />
        </Field>

        <div className="span-2">
          <Field label={L.notes} htmlFor="f-notes" error={errors.notes}>
            <textarea id="f-notes" className="input" rows={3} value={v.notes} onChange={set('notes')} maxLength={1000} {...describe('notes')} />
          </Field>
        </div>
      </div>

      {Object.values(errors).some(Boolean) && (
        <p className="form-error" role="alert">
          Please fix the highlighted fields and try again.
        </p>
      )}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn primary">
          <Save size={16} aria-hidden="true" /> {submitLabel}
        </button>
      </div>
    </form>
  );
}
