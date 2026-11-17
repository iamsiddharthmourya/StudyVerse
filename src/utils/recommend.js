// Transparent, rule-based study recommendations. This is NOT machine learning:
// every task gets a score from simple, visible rules, and the reasons are returned with it.
import { diffDays, toDateStr, fmtDate } from './dates.js';
import { isOverdue } from './stats.js';

const PRIORITY_POINTS = { High: 30, Medium: 18, Low: 8 };
const DIFFICULTY_POINTS = { Hard: 6, Medium: 3, Easy: 0 };

/** Score one task. Higher = do it sooner. Returns the score and plain-language reasons. */
export function scoreTask(task, now = new Date()) {
  const reasons = [];
  let score = 0;
  const today = toDateStr(now);
  const days = diffDays(task.dueDate, today);

  if (isOverdue(task, now)) {
    score += 45;
    reasons.push(`Overdue (was due ${fmtDate(task.dueDate)})`);
  } else if (days <= 0) {
    score += 35;
    reasons.push('Due today');
  } else if (days === 1) {
    score += 30;
    reasons.push('Due tomorrow');
  } else if (days <= 3) {
    score += 20;
    reasons.push(`Due in ${days} days`);
  } else if (days <= 7) {
    score += 10;
    reasons.push(`Due in ${days} days`);
  } else {
    score += 3;
    reasons.push(`Due in ${days} days (not urgent yet)`);
  }

  score += PRIORITY_POINTS[task.priority] ?? 0;
  reasons.push(`${task.priority} priority`);

  score += DIFFICULTY_POINTS[task.difficulty] ?? 0;
  if (task.difficulty === 'Hard') reasons.push('Hard task: start early, in shorter sessions');

  if (task.type === 'exam') {
    score += 5;
    reasons.push('Exam preparation');
  }
  return { task, score, reasons };
}

export function rankTasks(tasks, now = new Date()) {
  return tasks
    .filter((t) => !t.completed)
    .map((t) => scoreTask(t, now))
    .sort((a, b) => b.score - a.score || a.task.dueDate.localeCompare(b.task.dueDate));
}

/** Hard tasks get shorter sessions (75% of the preferred length). */
export function maxSession(task, session) {
  if (task.difficulty === 'Hard') return Math.max(15, Math.round((session * 0.75) / 5) * 5);
  return session;
}

/**
 * Fit the highest-ranked pending tasks into the time the student has.
 * Total study + break minutes never exceeds `available`.
 */
export function buildPlan(tasks, { available, session, breakMin }, now = new Date()) {
  const ranked = rankTasks(tasks, now);
  const blocks = [];
  let remaining = Math.max(0, Math.round(available));
  let first = true;
  const covered = [];

  for (const r of ranked) {
    if (remaining < 10) break;
    let need = Number(r.task.duration) || 0;
    const cap = maxSession(r.task, session);
    let allocated = 0;
    while (need > 0) {
      const breakCost = first ? 0 : breakMin;
      const room = remaining - breakCost;
      if (room < Math.min(10, need)) break;
      const chunk = Math.min(need, cap, room);
      if (!first) {
        blocks.push({ kind: 'break', minutes: breakMin });
        remaining -= breakMin;
      }
      blocks.push({
        kind: 'study',
        taskId: r.task.id,
        title: r.task.title,
        subject: r.task.subject,
        difficulty: r.task.difficulty,
        minutes: chunk,
        reasons: allocated === 0 ? r.reasons : ['Continuation of the previous session'],
      });
      remaining -= chunk;
      need -= chunk;
      allocated += chunk;
      first = false;
    }
    if (allocated > 0) covered.push({ task: r.task, allocated, of: Number(r.task.duration) || 0 });
  }

  const studyMinutes = blocks.filter((b) => b.kind === 'study').reduce((a, b) => a + b.minutes, 0);
  const breakMinutes = blocks.filter((b) => b.kind === 'break').reduce((a, b) => a + b.minutes, 0);
  const notCovered = ranked.filter((r) => !covered.some((c) => c.task.id === r.task.id)).map((r) => r.task);
  return { blocks, studyMinutes, breakMinutes, covered, notCovered, available };
}
