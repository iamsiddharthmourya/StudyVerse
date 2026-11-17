import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info, ListChecks, TrendingUp } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from '../components/ui.jsx';
import { ActivityChart, ChartCard, CompletionRows, Donut, TrendLine } from '../components/charts.jsx';
import { attention, dailyTrend, groupStats, onTimeLate, summarize, weekActivity, weeklyTrend } from '../utils/stats.js';
import { fmtDate, fmtDuration, fmtTime, startOfWeek, todayStr } from '../utils/dates.js';
import { COLORS, DIFFICULTIES, DIFF_COLOR, PRIORITIES, PRIORITY_COLOR } from '../utils/constants.js';

export default function Analytics() {
  const { tasks } = useStore();
  const today = todayStr();
  const weekStart = startOfWeek(today);

  const d = useMemo(() => {
    const now = new Date();
    return {
      sum: summarize(tasks, now),
      activity: weekActivity(tasks, weekStart),
      daily: dailyTrend(tasks, today, 14),
      weekly: weeklyTrend(tasks, weekStart, 6),
      timing: onTimeLate(tasks),
      subjects: groupStats(tasks, 'subject'),
      priority: groupStats(tasks, 'priority', PRIORITIES),
      difficulty: groupStats(tasks, 'difficulty', DIFFICULTIES),
      attn: attention(tasks, now),
    };
  }, [tasks, today, weekStart]);

  if (!tasks.length) {
    return (
      <div className="stack-lg">
        <PageHeader title="Performance Analytics" subtitle="Insights built from your own task data." />
        <div className="card">
          <EmptyState icon={TrendingUp} title="No data to analyse yet" text="Add and complete some tasks, and your analytics will appear here." />
        </div>
      </div>
    );
  }

  const { sum, timing } = d;
  const timePct = sum.plannedMinutes ? Math.round((sum.doneMinutes / sum.plannedMinutes) * 100) : 0;
  const timedTotal = timing.onTime + timing.late;

  return (
    <div className="stack-lg">
      <PageHeader title="Performance Analytics" subtitle="Insights built from your own task data." />

      <div className="banner info" role="note">
        <Info size={16} aria-hidden="true" />
        <span>
          These charts measure <strong>task completion and study planning only</strong>. They are not exam scores or grades, and they do not measure how well you have learned something.
        </span>
      </div>

      <section className="grid g4">
        <div className="stat">
          <div className="stat-icon t-violet"><ListChecks size={20} aria-hidden="true" /></div>
          <div><div className="stat-label">Completion rate</div><div className="stat-value">{sum.pct}%</div><div className="stat-sub">{sum.completed} of {sum.total} tasks</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon t-blue"><Clock size={20} aria-hidden="true" /></div>
          <div><div className="stat-label">Study time done</div><div className="stat-value">{fmtDuration(sum.doneMinutes)}</div><div className="stat-sub">of {fmtDuration(sum.plannedMinutes)} planned</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon t-teal"><CheckCircle2 size={20} aria-hidden="true" /></div>
          <div><div className="stat-label">Finished on time</div><div className="stat-value">{timedTotal ? Math.round((timing.onTime / timedTotal) * 100) : 0}%</div><div className="stat-sub">{timing.onTime} on time · {timing.late} late</div></div>
        </div>
        <div className="stat">
          <div className="stat-icon t-rose"><AlertTriangle size={20} aria-hidden="true" /></div>
          <div><div className="stat-label">Overdue now</div><div className="stat-value">{sum.overdue}</div><div className="stat-sub">{fmtDuration(sum.pendingMinutes)} still pending</div></div>
        </div>
      </section>

      <section className="grid g2">
        <ChartCard title="Weekly activity" subtitle="This week, Monday to Sunday" table={{ cols: [{ key: 'day', label: 'Day' }, { key: 'completed', label: 'Completed' }, { key: 'due', label: 'Due' }, { key: 'minutes', label: 'Minutes done' }], rows: d.activity }}>
          <ActivityChart data={d.activity} />
        </ChartCard>
        <ChartCard title="Daily completion trend" subtitle="Tasks completed per day, last 14 days" table={{ cols: [{ key: 'label', label: 'Date' }, { key: 'completed', label: 'Completed' }], rows: d.daily }}>
          <TrendLine data={d.daily} yKey="completed" name="Completed" />
        </ChartCard>
      </section>

      <section className="grid g2">
        <ChartCard title="Weekly completion trend" subtitle="% of tasks completed among those due each week (week starting)" table={{ cols: [{ key: 'label', label: 'Week starting' }, { key: 'pct', label: '% completed' }, { key: 'completed', label: 'Done' }, { key: 'total', label: 'Due' }], rows: d.weekly }}>
          <TrendLine data={d.weekly} yKey="pct" name="Completion" color={COLORS.teal} unit="%" domain={[0, 100]} />
        </ChartCard>
        <ChartCard
          title="Completed vs pending"
          table={{ cols: [{ key: 'name', label: 'Status' }, { key: 'value', label: 'Tasks' }], rows: [{ name: 'Completed', value: sum.completed }, { name: 'Pending', value: sum.pending }] }}
        >
          <Donut
            data={[
              { name: 'Completed', value: sum.completed, color: COLORS.teal },
              { name: 'Pending', value: sum.pending, color: COLORS.slate },
            ]}
            centerValue={`${sum.pct}%`}
            centerLabel="done"
          />
        </ChartCard>
      </section>

      <section className="grid g3">
        <ChartCard
          title="On-time vs late"
          subtitle="Completed tasks, by whether they were finished before the deadline"
          table={{ cols: [{ key: 'name', label: 'Timing' }, { key: 'value', label: 'Tasks' }], rows: [{ name: 'On time', value: timing.onTime }, { name: 'Late', value: timing.late }] }}
        >
          <Donut
            data={[
              { name: 'On time', value: timing.onTime, color: COLORS.teal },
              { name: 'Late', value: timing.late, color: COLORS.rose },
            ]}
            centerValue={timedTotal}
            centerLabel="completed"
          />
        </ChartCard>
        <Card title="Priority-wise completion"><CompletionRows rows={d.priority} colorFor={(n) => PRIORITY_COLOR[n]} /></Card>
        <Card title="Difficulty-wise completion"><CompletionRows rows={d.difficulty} colorFor={(n) => DIFF_COLOR[n]} /></Card>
      </section>

      <section className="grid g2">
        <Card title="Subject-wise completion"><CompletionRows rows={d.subjects} /></Card>
        <Card title="Study time" subtitle="Estimated minutes from your tasks (not measured time)">
          <div className="time-row"><span>Total planned</span><strong>{fmtDuration(sum.plannedMinutes)}</strong></div>
          <div className="time-row"><span>Completed</span><strong>{fmtDuration(sum.doneMinutes)}</strong></div>
          <div className="time-row"><span>Still pending</span><strong>{fmtDuration(sum.pendingMinutes)}</strong></div>
          <ProgressBar value={timePct} label="Study time completed" color="var(--teal)" height={10} />
          <p className="muted small mt">{timePct}% of planned study time completed</p>
        </Card>
      </section>

      <Card title="Needs attention" subtitle="Overdue tasks and the subjects with the most unfinished work">
        {d.attn.overdueTasks.length || d.attn.subjects.length ? (
          <div className="grid g2">
            <div>
              <h3 className="sub-h">Overdue tasks</h3>
              {d.attn.overdueTasks.length ? (
                <ul className="mini-list">
                  {d.attn.overdueTasks.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <span className="mini-bar" style={{ background: 'var(--rose)' }} aria-hidden="true" />
                      <div className="mini-main">
                        <strong>{t.title}</strong>
                        <span className="muted small">{t.subject} · was due {fmtDate(t.dueDate)}, {fmtTime(t.dueTime)}</span>
                      </div>
                      <Badge tone="rose" icon={AlertTriangle}>Overdue</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">No overdue tasks. Great!</p>
              )}
            </div>
            <div>
              <h3 className="sub-h">Subjects to focus on</h3>
              <ul className="mini-list">
                {d.attn.subjects.map((s) => (
                  <li key={s.name}>
                    <div className="mini-main">
                      <strong>{s.name}</strong>
                      <span className="muted small">
                        {s.pending} pending{s.overdue ? ` · ${s.overdue} overdue` : ''} · {s.pct}% done
                      </span>
                    </div>
                    {s.overdue > 0 ? <Badge tone="rose" icon={AlertTriangle}>Overdue work</Badge> : <Badge tone="amber">Pending work</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <EmptyState icon={CheckCircle2} title="Nothing needs attention" text="You have no overdue or pending work." />
        )}
      </Card>
    </div>
  );
}
