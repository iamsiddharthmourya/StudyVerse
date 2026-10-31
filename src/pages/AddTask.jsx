import { useState } from 'react';
import { CheckCircle2, Lightbulb } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { Card, PageHeader, useUI } from '../components/ui.jsx';
import TaskForm from '../components/TaskForm.jsx';
import { fmtDate, fmtTime } from '../utils/dates.js';
import { TYPE_LABEL } from '../utils/constants.js';

export default function AddTask({ navigate }) {
  const { tasks, addTask } = useStore();
  const { toast } = useUI();
  const [formKey, setFormKey] = useState(0);

  const recent = [...tasks]
    .filter((t) => !t.demo)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 4);

  const onSubmit = (values) => {
    const t = addTask(values);
    toast(`“${t.title}” was added to your planner.`);
    setFormKey((k) => k + 1); // fresh blank form
  };

  return (
    <div className="stack-lg">
      <PageHeader title="Add Task" subtitle="Create a task, assignment or exam. It is saved immediately and appears on your dashboard, lists and calendar." />
      <div className="grid g-form">
        <Card title="Task details">
          <TaskForm key={formKey} submitLabel="Add task" onSubmit={onSubmit} />
        </Card>
        <div className="stack">
          <Card title="Tips">
            <ul className="tips">
              <li>
                <Lightbulb size={15} aria-hidden="true" /> Use <strong>High</strong> priority only for what truly cannot slip.
              </li>
              <li>
                <Lightbulb size={15} aria-hidden="true" /> Break big jobs into tasks of 30–90 minutes.
              </li>
              <li>
                <Lightbulb size={15} aria-hidden="true" /> For exams, list the syllabus topics in the notes. The assistant uses them to plan your revision.
              </li>
            </ul>
          </Card>
          <Card title="Recently added by you">
            {recent.length ? (
              <ul className="mini-list">
                {recent.map((t) => (
                  <li key={t.id}>
                    <CheckCircle2 size={16} className="ok-icon" aria-hidden="true" />
                    <div className="mini-main">
                      <strong>{t.title}</strong>
                      <span className="muted small">
                        {TYPE_LABEL[t.type]} · {fmtDate(t.dueDate)}, {fmtTime(t.dueTime)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Tasks you create will show up here.</p>
            )}
            <button className="btn ghost sm mt" onClick={() => navigate('daily')}>
              Go to Daily Tasks
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
