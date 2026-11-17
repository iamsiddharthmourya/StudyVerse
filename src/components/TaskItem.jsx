import { AlertTriangle, CalendarClock, Check, Clock, Pencil, Trash2 } from 'lucide-react';
import { Badge } from './ui.jsx';
import { useUI } from './ui.jsx';
import { useStore } from '../state/store.jsx';
import { useTaskEditor } from './TaskEditor.jsx';
import { fmtDate, fmtDuration, fmtTime } from '../utils/dates.js';
import { dueStatus } from '../utils/stats.js';
import { DIFF_COLOR, PRIORITY_COLOR, TYPE_COLOR, TYPE_LABEL } from '../utils/constants.js';

const PRIORITY_TONE = { High: 'rose', Medium: 'amber', Low: 'teal' };
const DIFF_TONE = { Hard: 'violet', Medium: 'blue', Easy: 'teal' };

export function StatusBadge({ task }) {
  const s = dueStatus(task);
  if (s === 'done') return <Badge tone="teal" icon={Check}>{task.type === 'assignment' ? 'Submitted' : 'Completed'}</Badge>;
  if (s === 'overdue') return <Badge tone="rose" icon={AlertTriangle}>Overdue</Badge>;
  if (s === 'soon') return <Badge tone="amber" icon={CalendarClock}>Due soon</Badge>;
  return null;
}

/** One task row. `compact` hides some metadata (used in calendar panels and week columns). */
export default function TaskItem({ task, compact = false, showDate = true, extra }) {
  const { toggleTask, deleteTask } = useStore();
  const { openTask } = useTaskEditor();
  const { toast, confirm } = useUI();

  const doneLabel = task.type === 'assignment' ? 'submitted' : 'completed';

  const onToggle = () => {
    toggleTask(task.id);
    toast(task.completed ? `Reopened “${task.title}”.` : `Marked ${doneLabel}: “${task.title}”.`, 'success');
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete this task?',
      message: `“${task.title}” will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      deleteTask(task.id);
      toast('Task deleted.', 'info');
    }
  };

  return (
    <article className={`task ${task.completed ? 'done' : ''} ${compact ? 'compact' : ''}`} style={{ '--bar': PRIORITY_COLOR[task.priority] }}>
      <button
        type="button"
        className={`check ${task.completed ? 'on' : ''}`}
        onClick={onToggle}
        aria-pressed={task.completed}
        aria-label={task.completed ? `Reopen ${task.title}` : `Mark ${task.title} ${doneLabel}`}
      >
        {task.completed && <Check size={14} aria-hidden="true" />}
      </button>

      <div className="task-main">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          <span className="dot" style={{ background: TYPE_COLOR[task.type] }} aria-hidden="true" />
          <span>{task.subject}</span>
          <span className="sep" aria-hidden="true">·</span>
          <span>{TYPE_LABEL[task.type]}</span>
          {showDate && (
            <>
              <span className="sep" aria-hidden="true">·</span>
              <span>
                {fmtDate(task.dueDate)}, {fmtTime(task.dueTime)}
              </span>
            </>
          )}
          <span className="sep" aria-hidden="true">·</span>
          <span className="inline-icon">
            <Clock size={12} aria-hidden="true" /> {fmtDuration(task.duration)}
          </span>
        </div>
        {!compact && task.goal && <div className="task-goal">Goal: {task.goal}</div>}
        <div className="task-badges">
          <Badge tone={PRIORITY_TONE[task.priority]} title="Priority">{task.priority} priority</Badge>
          <Badge tone={DIFF_TONE[task.difficulty]} title="Difficulty">{task.difficulty}</Badge>
          <StatusBadge task={task} />
          {task.demo && <Badge tone="slate" title="Sample data you can delete">Demo</Badge>}
        </div>
      </div>

      <div className="task-actions">
        {extra}
        <button className="icon-btn" aria-label={`Edit ${task.title}`} onClick={() => openTask({ task })}>
          <Pencil size={16} />
        </button>
        <button className="icon-btn danger" aria-label={`Delete ${task.title}`} onClick={onDelete}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

export { DIFF_COLOR };
