import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, ChevronLeft, ChevronRight, Clock, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { useTaskEditor } from '../components/TaskEditor.jsx';
import { Badge, Card, PageHeader, ProgressBar, useUI } from '../components/ui.jsx';
import { addDays, dueDateTime, fmtDate, fmtDuration, fmtTime, startOfWeek, todayStr, weekDays } from '../utils/dates.js';
import { dueStatus, weekStats } from '../utils/stats.js';
import { PRIORITY_COLOR, TYPE_COLOR, TYPE_LABEL } from '../utils/constants.js';

function WeekTask({ task, days }) {
  const { toggleTask, moveTask } = useStore();
  const { openTask } = useTaskEditor();
  const { toast } = useUI();
  const status = dueStatus(task);
  return (
    <div className={`wk-task ${task.completed ? 'done' : ''}`} style={{ '--bar': PRIORITY_COLOR[task.priority] }}>
      <div className="wk-top">
        <button
          className={`check ${task.completed ? 'on' : ''}`}
          aria-pressed={task.completed}
          aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onClick={() => {
            toggleTask(task.id);
            toast(task.completed ? 'Task reopened.' : 'Task completed. Nice work!');
          }}
        >
          {task.completed && <Check size={13} aria-hidden="true" />}
        </button>
        <div className="wk-title">{task.title}</div>
        <button className="icon-btn sm" aria-label={`Edit ${task.title}`} onClick={() => openTask({ task })}>
          <Pencil size={14} />
        </button>
      </div>
      <div className="wk-meta">
        <span className="dot" style={{ background: TYPE_COLOR[task.type] }} aria-hidden="true" />
        {task.subject} · {fmtTime(task.dueTime)} · {fmtDuration(task.duration)}
      </div>
      <div className="wk-badges">
        {task.priority === 'High' && <Badge tone="rose">High priority</Badge>}
        {task.type !== 'daily' && <Badge tone="slate">{TYPE_LABEL[task.type]}</Badge>}
        {status === 'overdue' && <Badge tone="rose" icon={AlertTriangle}>Overdue</Badge>}
        {status === 'soon' && <Badge tone="amber" icon={CalendarClock}>Due soon</Badge>}
      </div>
      <label className="wk-move">
        <span className="sr-only">Reschedule {task.title}</span>
        <select
          className="input sm"
          value={task.dueDate}
          aria-label={`Reschedule ${task.title}`}
          onChange={(e) => {
            moveTask(task.id, e.target.value);
            toast(`Moved to ${fmtDate(e.target.value, { weekday: 'long' })}.`);
          }}
        >
          {days.map((d) => (
            <option key={d} value={d}>
              Move to {fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Goals({ weekStart }) {
  const { goals, addGoal, toggleGoal, deleteGoal } = useStore();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const list = goals.filter((g) => g.weekStart === weekStart);
  const done = list.filter((g) => g.done).length;

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return setErr('Type a goal first.');
    if (t.length > 120) return setErr('Keep goals under 120 characters.');
    addGoal(weekStart, t);
    setText('');
    setErr('');
  };

  return (
    <Card title="Weekly study goals" subtitle={list.length ? `${done} of ${list.length} achieved` : 'What do you want to achieve this week?'}>
      <ul className="goal-list">
        {list.map((g) => (
          <li key={g.id} className={g.done ? 'done' : ''}>
            <button className={`check ${g.done ? 'on' : ''}`} aria-pressed={g.done} aria-label={`${g.done ? 'Unmark' : 'Mark'} goal: ${g.text}`} onClick={() => toggleGoal(g.id)}>
              {g.done && <Check size={13} aria-hidden="true" />}
            </button>
            <span>{g.text}</span>
            <button className="icon-btn sm danger" aria-label={`Delete goal: ${g.text}`} onClick={() => deleteGoal(g.id)}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {!list.length && <li className="muted small">No goals for this week yet.</li>}
      </ul>
      <form className="goal-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="goal-input">New weekly goal</label>
        <input id="goal-input" className="input" placeholder="Add a weekly goal" value={text} onChange={(e) => { setText(e.target.value); setErr(''); }} aria-invalid={!!err} />
        <button className="btn primary sm" type="submit">
          <Plus size={14} aria-hidden="true" /> Add
        </button>
      </form>
      {err && <p className="field-err" role="alert">{err}</p>}
    </Card>
  );
}

export default function WeeklyPlan() {
  const { tasks, settings } = useStore();
  const { openTask } = useTaskEditor();
  const today = todayStr();
  const [weekStart, setWeekStart] = useState(startOfWeek(today));
  const days = weekDays(weekStart);
  const thisWeek = startOfWeek(today) === weekStart;

  const { stats, byDay } = useMemo(() => {
    const s = weekStats(tasks, weekStart);
    const map = Object.fromEntries(days.map((d) => [d, []]));
    s.tasks.forEach((t) => map[t.dueDate]?.push(t));
    Object.values(map).forEach((l) => l.sort((a, b) => dueDateTime(a) - dueDateTime(b)));
    return { stats: s, byDay: map };
  }, [tasks, weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const range = `${fmtDate(days[0], { day: 'numeric', month: 'short' })} – ${fmtDate(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const timePct = stats.plannedMinutes ? (stats.doneMinutes / stats.plannedMinutes) * 100 : 0;

  return (
    <div className="stack-lg">
      <PageHeader
        title="Weekly Plan"
        subtitle="See the whole week's workload at a glance."
        actions={
          <button className="btn primary" onClick={() => openTask({ defaults: { dueDate: thisWeek ? today : days[0], type: 'weekly' } })}>
            <Plus size={16} aria-hidden="true" /> Add task
          </button>
        }
      />

      <div className="card toolbar">
        <div className="date-nav">
          <button className="icon-btn" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft size={18} />
          </button>
          <strong className="range">{range}</strong>
          <button className="icon-btn" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight size={18} />
          </button>
          <button className="btn ghost sm" onClick={() => setWeekStart(startOfWeek(today))} disabled={thisWeek}>
            This week
          </button>
        </div>
      </div>

      <section className="grid g3">
        <Card title="Weekly completion">
          <div className="big-pct">{stats.pct}%</div>
          <ProgressBar value={stats.pct} label="Weekly completion" height={10} color="var(--teal)" />
          <p className="muted small mt">
            <Target size={13} aria-hidden="true" /> {stats.completed} of {stats.total} done · target {settings.weeklyGoalPct}%
            {stats.total > 0 && stats.pct >= settings.weeklyGoalPct ? ' · target reached' : ''}
          </p>
        </Card>
        <Card title="Planned vs completed time">
          <div className="time-row">
            <span>
              <Clock size={14} aria-hidden="true" /> Planned
            </span>
            <strong>{fmtDuration(stats.plannedMinutes)}</strong>
          </div>
          <div className="time-row">
            <span>
              <Check size={14} aria-hidden="true" /> Completed
            </span>
            <strong>{fmtDuration(stats.doneMinutes)}</strong>
          </div>
          <ProgressBar value={timePct} label="Study time completed" />
        </Card>
        <Goals weekStart={weekStart} />
      </section>

      <section className="week-grid" aria-label="Tasks by day">
        {days.map((d) => {
          const list = byDay[d];
          const minutes = list.reduce((a, t) => a + t.duration, 0);
          return (
            <div key={d} className={`day-col ${d === today ? 'today' : ''}`}>
              <header>
                <div>
                  <strong>{fmtDate(d, { weekday: 'short' })}</strong>
                  <span className="muted small"> {fmtDate(d, { day: 'numeric', month: 'short' })}</span>
                  {d === today && <span className="today-tag">Today</span>}
                </div>
                <button className="icon-btn sm" aria-label={`Add task on ${fmtDate(d)}`} onClick={() => openTask({ defaults: { dueDate: d, type: 'weekly' } })}>
                  <Plus size={15} />
                </button>
              </header>
              <div className="day-sum muted small">
                {list.length} task{list.length === 1 ? '' : 's'} · {fmtDuration(minutes)}
              </div>
              <div className="day-tasks">
                {list.map((t) => (
                  <WeekTask key={t.id} task={t} days={days} />
                ))}
                {!list.length && <p className="muted small day-empty">Free day</p>}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
