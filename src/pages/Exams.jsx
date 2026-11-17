import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CalendarClock, Check, ClipboardList, GraduationCap, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { useTaskEditor } from '../components/TaskEditor.jsx';
import { Badge, EmptyState, PageHeader, Segmented, useUI } from '../components/ui.jsx';
import { countdownLabel, diffDays, dueDateTime, fmtDate, fmtTime, todayStr } from '../utils/dates.js';
import { isOverdue } from '../utils/stats.js';

function Deadline({ task }) {
  const { toggleTask, deleteTask } = useStore();
  const { openTask } = useTaskEditor();
  const { toast, confirm } = useUI();
  const isExam = task.type === 'exam';
  const label = countdownLabel(task);
  const days = diffDays(task.dueDate, todayStr());
  const late = isOverdue(task);
  const soon = !task.completed && !late && days <= 3;
  const topics = isExam ? (task.notes || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [];

  let badge;
  if (task.completed) badge = <Badge tone="teal" icon={Check}>{isExam ? 'Completed' : 'Submitted'}</Badge>;
  else if (late) badge = <Badge tone="rose" icon={AlertTriangle}>{label}</Badge>;
  else if (soon) badge = <Badge tone="amber" icon={CalendarClock}>{label}</Badge>;
  else badge = <Badge tone="blue" icon={CalendarClock}>{label}</Badge>;

  return (
    <article className={`deadline ${task.completed ? 'done' : ''} ${late ? 'late' : ''} ${soon ? 'soon' : ''}`}>
      <div className="deadline-date" aria-hidden="true">
        <strong>{fmtDate(task.dueDate, { day: 'numeric' })}</strong>
        <span>{fmtDate(task.dueDate, { month: 'short' })}</span>
      </div>
      <div className="deadline-main">
        <div className="deadline-top">
          <h3>{task.title}</h3>
          {badge}
        </div>
        <p className="muted small">
          {task.subject} · {fmtDate(task.dueDate, { weekday: 'long', day: 'numeric', month: 'long' })} at {fmtTime(task.dueTime)}
        </p>
        {isExam ? (
          topics.length ? (
            <div className="topics">
              <span className="muted small inline-icon"><BookOpen size={13} aria-hidden="true" /> Revise:</span>
              {topics.map((t) => (
                <span key={t} className="topic">{t}</span>
              ))}
            </div>
          ) : (
            <p className="muted small">No syllabus topics added yet. Edit the exam to list them.</p>
          )
        ) : (
          task.notes && <p className="small">{task.notes}</p>
        )}
        {late && <p className="warn-text"><AlertTriangle size={13} aria-hidden="true" /> This {isExam ? 'exam date has passed' : 'assignment is past its deadline'} and is not marked {isExam ? 'completed' : 'submitted'}.</p>}
      </div>
      <div className="deadline-actions">
        <button
          className={`btn sm ${task.completed ? 'ghost' : 'primary'}`}
          onClick={() => {
            toggleTask(task.id);
            toast(task.completed ? 'Marked as not done.' : isExam ? 'Exam marked as completed.' : 'Assignment marked as submitted.');
          }}
        >
          {task.completed ? <RotateCcw size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          {task.completed ? 'Reopen' : isExam ? 'Mark completed' : 'Mark submitted'}
        </button>
        <button className="icon-btn" aria-label={`Edit ${task.title}`} onClick={() => openTask({ task })}>
          <Pencil size={16} />
        </button>
        <button
          className="icon-btn danger"
          aria-label={`Delete ${task.title}`}
          onClick={async () => {
            const ok = await confirm({ title: `Delete this ${isExam ? 'exam' : 'assignment'}?`, message: `“${task.title}” will be permanently removed.`, confirmLabel: 'Delete', danger: true });
            if (ok) {
              deleteTask(task.id);
              toast('Deleted.', 'info');
            }
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export default function Exams() {
  const { tasks } = useStore();
  const { openTask } = useTaskEditor();
  const [tab, setTab] = useState('exam');
  const [status, setStatus] = useState('active');

  const { items, counts } = useMemo(() => {
    const ofType = tasks.filter((t) => t.type === tab);
    const sorted = (list) => [...list].sort((a, b) => dueDateTime(a) - dueDateTime(b));
    const filtered = status === 'active' ? ofType.filter((t) => !t.completed) : status === 'done' ? ofType.filter((t) => t.completed) : ofType;
    return {
      items: status === 'done' ? sorted(filtered).reverse() : sorted(filtered),
      counts: {
        active: ofType.filter((t) => !t.completed).length,
        done: ofType.filter((t) => t.completed).length,
        all: ofType.length,
      },
    };
  }, [tasks, tab, status]);

  const isExam = tab === 'exam';
  const noun = isExam ? 'exam' : 'assignment';

  return (
    <div className="stack-lg">
      <PageHeader
        title="Exams & Assignments"
        subtitle="Track academic deadlines with a live countdown."
        actions={
          <button className="btn primary" onClick={() => openTask({ defaults: { type: tab, priority: 'High', duration: isExam ? 120 : 90 }, lockType: true })}>
            <Plus size={16} aria-hidden="true" /> Add {noun}
          </button>
        }
      />

      <div className="row wrap-gap">
        <div className="tabs" role="tablist" aria-label="Deadline type">
          <button role="tab" aria-selected={isExam} className={isExam ? 'active' : ''} onClick={() => setTab('exam')}>
            <GraduationCap size={16} aria-hidden="true" /> Exams
          </button>
          <button role="tab" aria-selected={!isExam} className={!isExam ? 'active' : ''} onClick={() => setTab('assignment')}>
            <ClipboardList size={16} aria-hidden="true" /> Assignments
          </button>
        </div>
        <Segmented
          label="Status filter"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: isExam ? 'Upcoming' : 'To submit', count: counts.active },
            { value: 'done', label: isExam ? 'Completed' : 'Submitted', count: counts.done },
            { value: 'all', label: 'All', count: counts.all },
          ]}
        />
      </div>

      {items.length ? (
        <div className="stack">
          {items.map((t) => (
            <Deadline key={t.id} task={t} />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={isExam ? GraduationCap : ClipboardList}
            title={counts.all ? `No ${status === 'done' ? 'completed' : 'pending'} ${noun}s` : `No ${noun}s yet`}
            text={isExam ? 'Add an exam with its date and syllabus topics to get a countdown and revision help.' : 'Add an assignment with its due date to track submission.'}
            action={
              <button className="btn primary" onClick={() => openTask({ defaults: { type: tab, priority: 'High' }, lockType: true })}>
                <Plus size={16} aria-hidden="true" /> Add {noun}
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
