import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { useTaskEditor } from '../components/TaskEditor.jsx';
import { Card, EmptyState, PageHeader, Segmented } from '../components/ui.jsx';
import TaskItem from '../components/TaskItem.jsx';
import { DAY_NAMES, addDays, dueDateTime, fmtDate, monthGrid, parseDate, startOfWeek, todayStr, toDateStr, weekDays } from '../utils/dates.js';
import { TYPES, TYPE_COLOR } from '../utils/constants.js';

function Chip({ task }) {
  return (
    <span className={`cal-chip ${task.completed ? 'done' : ''}`} style={{ '--c': TYPE_COLOR[task.type] }} title={`${task.title} (${task.completed ? 'done' : 'pending'})`}>
      {task.completed ? <Check size={10} aria-hidden="true" /> : <span className="chip-dot" aria-hidden="true" />}
      <span className="chip-text">{task.title}</span>
    </span>
  );
}

export default function CalendarPage() {
  const { tasks } = useStore();
  const { openTask } = useTaskEditor();
  const today = todayStr();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(today); // any date inside the visible month/week
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(() => {
    const m = {};
    tasks.forEach((t) => (m[t.dueDate] ||= []).push(t));
    Object.values(m).forEach((l) => l.sort((a, b) => dueDateTime(a) - dueDateTime(b)));
    return m;
  }, [tasks]);

  const cur = parseDate(cursor);
  const cells = view === 'month' ? monthGrid(cur.getFullYear(), cur.getMonth()) : weekDays(cursor);
  const title =
    view === 'month'
      ? cur.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
      : `${fmtDate(cells[0], { day: 'numeric', month: 'short' })} – ${fmtDate(cells[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const step = (dir) => {
    if (view === 'week') return setCursor(addDays(cursor, dir * 7));
    const d = new Date(cur.getFullYear(), cur.getMonth() + dir, 1);
    setCursor(toDateStr(d));
  };

  const goToday = () => {
    setCursor(today);
    setSelected(today);
  };

  const selTasks = byDate[selected] || [];
  const maxChips = view === 'month' ? 3 : 8;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Calendar"
        subtitle="Every task, assignment and exam in one place. Click a date to see or add tasks."
        actions={
          <button className="btn primary" onClick={() => openTask({ defaults: { dueDate: selected } })}>
            <Plus size={16} aria-hidden="true" /> Add task
          </button>
        }
      />

      <div className="card toolbar">
        <div className="date-nav">
          <button className="icon-btn" aria-label={view === 'month' ? 'Previous month' : 'Previous week'} onClick={() => step(-1)}>
            <ChevronLeft size={18} />
          </button>
          <strong className="range">{title}</strong>
          <button className="icon-btn" aria-label={view === 'month' ? 'Next month' : 'Next week'} onClick={() => step(1)}>
            <ChevronRight size={18} />
          </button>
          <button className="btn ghost sm" onClick={goToday}>
            Today
          </button>
        </div>
        <Segmented
          label="Calendar view"
          value={view}
          onChange={(v) => {
            setView(v);
            setCursor(selected);
          }}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
          ]}
        />
      </div>

      <div className="grid g-cal">
        <div className="card cal-card">
          <div className="cal-head" role="row">
            {DAY_NAMES.map((d) => (
              <div key={d} className="cal-dow">
                {d}
              </div>
            ))}
          </div>
          <div className={`cal-grid ${view}`} role="grid" aria-label={title}>
            {cells.map((d) => {
              const list = byDate[d] || [];
              const outside = view === 'month' && parseDate(d).getMonth() !== cur.getMonth();
              const pending = list.filter((t) => !t.completed).length;
              return (
                <button
                  key={d}
                  role="gridcell"
                  className={`cal-cell ${outside ? 'outside' : ''} ${d === today ? 'today' : ''} ${d === selected ? 'selected' : ''}`}
                  onClick={() => setSelected(d)}
                  aria-label={`${fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: ${list.length} task${list.length === 1 ? '' : 's'}, ${pending} pending`}
                  aria-pressed={d === selected}
                >
                  <span className="cal-num">{parseDate(d).getDate()}</span>
                  <span className="cal-chips">
                    {list.slice(0, maxChips).map((t) => (
                      <Chip key={t.id} task={t} />
                    ))}
                    {list.length > maxChips && <span className="cal-more">+{list.length - maxChips} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="cal-legend" aria-label="Legend">
            {TYPES.map((t) => (
              <li key={t.value}>
                <span className="swatch" style={{ background: TYPE_COLOR[t.value] }} aria-hidden="true" /> {t.label}
              </li>
            ))}
            <li>
              <Check size={12} aria-hidden="true" /> Completed
            </li>
          </ul>
        </div>

        <Card
          title={fmtDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}
          subtitle={`${selTasks.length} task${selTasks.length === 1 ? '' : 's'} · ${selTasks.filter((t) => t.completed).length} completed`}
          action={
            <button className="btn primary sm" onClick={() => openTask({ defaults: { dueDate: selected } })}>
              <Plus size={14} aria-hidden="true" /> New
            </button>
          }
          className="cal-side"
        >
          {selTasks.length ? (
            <div className="task-list">
              {selTasks.map((t) => (
                <TaskItem key={t.id} task={t} compact showDate={false} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing scheduled" text="Click “New” to add a task for this date." />
          )}
        </Card>
      </div>
    </div>
  );
}
