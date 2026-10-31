import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Flame, ListChecks, Pause, Play, Plus, RotateCcw, Sparkles, Target, Timer } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { useTaskEditor } from '../components/TaskEditor.jsx';
import { Badge, Card, EmptyState, ProgressBar, useUI } from '../components/ui.jsx';
import { ActivityChart, ChartCard, CompletionRows, Donut } from '../components/charts.jsx';
import { StatusBadge } from '../components/TaskItem.jsx';
import { countdownLabel, dueDateTime, fmtDate, fmtDuration, fmtTime, greeting, startOfWeek, todayStr } from '../utils/dates.js';
import { groupStats, streak, summarize, weekActivity, weekStats } from '../utils/stats.js';
import { rankTasks } from '../utils/recommend.js';
import { DIFFICULTIES, DIFF_COLOR, PRIORITIES, PRIORITY_COLOR, TYPE_LABEL } from '../utils/constants.js';

function FocusTimer({ minutes }) {
  const total = Math.max(1, minutes) * 60;
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const { toast } = useUI();
  const idle = useRef(true);

  // Follow the setting while idle.
  useEffect(() => {
    if (idle.current) setLeft(total);
  }, [total]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(id);
          setRunning(false);
          idle.current = true;
          toast('Focus session complete. Take a short break!', 'success');
          return total;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, total, toast]);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className="timer" aria-label="Quick focus timer">
      <div className="timer-title">
        <Timer size={16} aria-hidden="true" /> Quick focus timer
      </div>
      <div className="timer-time" role="timer" aria-live="off">
        {mm}:{ss}
      </div>
      <div className="timer-actions">
        <button
          className="btn light sm"
          onClick={() => {
            idle.current = false;
            setRunning((r) => !r);
          }}
        >
          {running ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {running ? 'Pause' : 'Start'}
        </button>
        <button
          className="icon-btn light"
          aria-label="Reset timer"
          onClick={() => {
            setRunning(false);
            idle.current = true;
            setLeft(total);
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone, sub }) {
  return (
    <div className="stat">
      <div className={`stat-icon t-${tone}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard({ navigate }) {
  const { tasks, settings, clearDemo } = useStore();
  const { openTask } = useTaskEditor();
  const { toast, confirm } = useUI();

  const today = todayStr();
  const weekStart = startOfWeek(today);
  const d = useMemo(() => {
    const now = new Date();
    const ranked = rankTasks(tasks, now);
    const urgent = ranked.filter((r) => r.task.dueDate <= today).slice(0, 5);
    return {
      sum: summarize(tasks, now),
      wk: weekStats(tasks, weekStart),
      activity: weekActivity(tasks, weekStart),
      st: streak(tasks),
      urgent,
      nextUp: ranked.slice(0, 3),
      deadlines: tasks
        .filter((t) => (t.type === 'exam' || t.type === 'assignment') && !t.completed)
        .sort((a, b) => dueDateTime(a) - dueDateTime(b))
        .slice(0, 5),
      subjects: groupStats(tasks, 'subject'),
      priority: groupStats(tasks, 'priority', PRIORITIES),
      difficulty: groupStats(tasks, 'difficulty', DIFFICULTIES),
    };
  }, [tasks, today, weekStart]);

  const hasDemo = tasks.some((t) => t.demo);
  const name = settings.name?.trim();

  const onClearDemo = async () => {
    const ok = await confirm({
      title: 'Remove demo data?',
      message: 'This deletes the sample tasks and goals only. Anything you added yourself is kept.',
      confirmLabel: 'Remove demo data',
      danger: true,
    });
    if (ok) {
      clearDemo();
      toast('Demo data removed.', 'info');
    }
  };

  const priorityList = d.urgent.length ? d.urgent : d.nextUp;

  return (
    <div className="stack-lg">
      {hasDemo && (
        <div className="banner info" role="note">
          <Sparkles size={16} aria-hidden="true" />
          <span>
            <strong>You are viewing demo data.</strong> These sample tasks make the dashboard look populated. Add your own tasks, or remove the samples.
          </span>
          <button className="btn ghost sm" onClick={onClearDemo}>
            Remove demo data
          </button>
        </div>
      )}

      <section className="hero">
        <div className="hero-text">
          <p className="hero-date">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <h2>
            {greeting()}
            {name ? `, ${name}` : ''}!
          </h2>
          <p className="hero-sub">
            {d.sum.pending
              ? `You have ${d.sum.pending} pending task${d.sum.pending === 1 ? '' : 's'} (${fmtDuration(d.sum.pendingMinutes)} of study time).`
              : 'You are all caught up. Add new tasks to keep the momentum going.'}
          </p>
          <div className="chips">
            <span className="chip-hero">
              <Flame size={15} aria-hidden="true" /> {d.st.count}-day streak
            </span>
            <span className="chip-hero">
              <Target size={15} aria-hidden="true" /> {d.sum.pct}% complete
            </span>
            <span className="chip-hero">
              <CheckCircle2 size={15} aria-hidden="true" /> {d.sum.completed} done
            </span>
          </div>
          <button className="btn light" onClick={() => openTask()}>
            <Plus size={16} aria-hidden="true" /> Add a task
          </button>
        </div>
        <FocusTimer minutes={settings.sessionMinutes} />
      </section>

      <section className="grid g4" aria-label="Task summary">
        <StatTile icon={ListChecks} label="Total tasks" value={d.sum.total} tone="violet" />
        <StatTile icon={CheckCircle2} label="Completed" value={d.sum.completed} tone="teal" sub={`${d.sum.pct}% of all tasks`} />
        <StatTile icon={Clock} label="Pending" value={d.sum.pending} tone="blue" sub={`${fmtDuration(d.sum.pendingMinutes)} to study`} />
        <StatTile icon={AlertTriangle} label="Overdue" value={d.sum.overdue} tone="rose" sub={d.sum.overdue ? 'Needs attention' : 'Nothing overdue'} />
      </section>

      <section className="grid g3">
        <Card title="Overall completion">
          <div className="big-pct">{d.sum.pct}%</div>
          <ProgressBar value={d.sum.pct} label="Overall completion" height={10} />
          <p className="muted small mt">
            {d.sum.completed} of {d.sum.total} tasks completed
          </p>
        </Card>
        <Card title="This week">
          <div className="big-pct">{d.wk.pct}%</div>
          <ProgressBar value={d.wk.pct} label="Weekly completion" height={10} color="var(--teal)" />
          <p className="muted small mt">
            {d.wk.completed} of {d.wk.total} tasks due this week · target {settings.weeklyGoalPct}%
          </p>
        </Card>
        <Card title="Study streak">
          <div className="streak">
            <Flame size={34} className={d.st.count ? 'flame on' : 'flame'} aria-hidden="true" />
            <div>
              <div className="big-pct">
                {d.st.count} <span className="unit">day{d.st.count === 1 ? '' : 's'}</span>
              </div>
              <p className="muted small">{d.st.doneToday ? 'Nice, you completed a task today.' : d.st.count ? 'Complete a task today to keep it alive.' : 'Complete a task to start a streak.'}</p>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid g2">
        <ChartCard
          title="Weekly activity"
          subtitle="Tasks completed vs tasks due, Monday to Sunday"
          table={{ cols: [{ key: 'day', label: 'Day' }, { key: 'completed', label: 'Completed' }, { key: 'due', label: 'Due' }], rows: d.activity }}
        >
          <ActivityChart data={d.activity} />
        </ChartCard>

        <Card title={d.urgent.length ? "Today's priority tasks" : 'Next up'} subtitle={d.urgent.length ? 'Overdue and due today, ranked by urgency' : 'Nothing due today. Here is what is coming next.'} action={<button className="btn ghost sm" onClick={() => navigate('daily')}>View all</button>}>
          {priorityList.length ? (
            <ul className="mini-list">
              {priorityList.map(({ task, reasons }) => (
                <li key={task.id}>
                  <span className="mini-bar" style={{ background: PRIORITY_COLOR[task.priority] }} aria-hidden="true" />
                  <div className="mini-main">
                    <strong>{task.title}</strong>
                    <span className="muted small">
                      {task.subject} · {fmtDate(task.dueDate)}, {fmtTime(task.dueTime)} · {fmtDuration(task.duration)}
                    </span>
                    <span className="muted small">Why: {reasons.slice(0, 2).join(' · ')}</span>
                  </div>
                  <StatusBadge task={task} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CheckCircle2} title="All clear" text="No pending tasks. Add one to get started." action={<button className="btn primary sm" onClick={() => openTask()}>Add task</button>} />
          )}
        </Card>
      </section>

      <section className="grid g2">
        <Card title="Upcoming exams & deadlines" action={<button className="btn ghost sm" onClick={() => navigate('exams')}>Open</button>}>
          {d.deadlines.length ? (
            <ul className="mini-list">
              {d.deadlines.map((t) => {
                const label = countdownLabel(t);
                const late = label.startsWith('Overdue');
                const soon = !late && (label === 'Due today' || label === 'Due tomorrow' || /^[1-3] days left$/.test(label));
                return (
                  <li key={t.id}>
                    <span className="mini-bar" style={{ background: t.type === 'exam' ? 'var(--rose)' : 'var(--amber)' }} aria-hidden="true" />
                    <div className="mini-main">
                      <strong>{t.title}</strong>
                      <span className="muted small">
                        {TYPE_LABEL[t.type]} · {t.subject} · {fmtDate(t.dueDate)}
                      </span>
                    </div>
                    <Badge tone={late ? 'rose' : soon ? 'amber' : 'blue'} icon={late ? AlertTriangle : CalendarClock}>
                      {label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={CalendarClock} title="No upcoming deadlines" text="Add an exam or assignment to see a countdown here." />
          )}
        </Card>

        <Card title="Subject-wise completion" subtitle="Share of tasks completed per subject">
          <CompletionRows rows={d.subjects} />
        </Card>
      </section>

      <section className="grid g3">
        <ChartCard title="By priority" table={{ cols: [{ key: 'name', label: 'Priority' }, { key: 'total', label: 'Tasks' }, { key: 'pct', label: '% done' }], rows: d.priority }}>
          <Donut data={d.priority.map((r) => ({ name: r.name, value: r.total, color: PRIORITY_COLOR[r.name] }))} centerValue={d.sum.total} centerLabel="tasks" />
        </ChartCard>
        <ChartCard title="By difficulty" table={{ cols: [{ key: 'name', label: 'Difficulty' }, { key: 'total', label: 'Tasks' }, { key: 'pct', label: '% done' }], rows: d.difficulty }}>
          <Donut data={d.difficulty.map((r) => ({ name: r.name, value: r.total, color: DIFF_COLOR[r.name] }))} centerValue={d.sum.total} centerLabel="tasks" />
        </ChartCard>
        <Card title="Estimated pending study time">
          <div className="big-pct">{fmtDuration(d.sum.pendingMinutes)}</div>
          <p className="muted small mt">
            Across {d.sum.pending} pending task{d.sum.pending === 1 ? '' : 's'}. At your daily budget of {fmtDuration(settings.dailyMinutes)}, that is about{' '}
            <strong>{Math.max(d.sum.pending ? 1 : 0, Math.ceil(d.sum.pendingMinutes / Math.max(1, settings.dailyMinutes)))} study day(s)</strong>.
          </p>
          <ProgressBar value={d.sum.plannedMinutes ? (d.sum.doneMinutes / d.sum.plannedMinutes) * 100 : 0} label="Study time completed" color="var(--teal)" />
          <p className="muted small mt">
            {fmtDuration(d.sum.doneMinutes)} of {fmtDuration(d.sum.plannedMinutes)} planned time completed
          </p>
        </Card>
      </section>
    </div>
  );
}
