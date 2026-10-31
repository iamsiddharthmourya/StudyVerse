// Pure functions that turn the task list into numbers for dashboards and charts.
import { dueDateTime, toDateStr, addDays, DAY_NAMES, todayStr, fmtDate } from './dates.js';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const isOverdue = (t, now = new Date()) => !t.completed && dueDateTime(t) < now;

/** 'done' | 'overdue' | 'soon' (due within 48h) | 'ok' */
export function dueStatus(t, now = new Date()) {
  if (t.completed) return 'done';
  const due = dueDateTime(t);
  if (due < now) return 'overdue';
  if (due - now <= 48 * 3600 * 1000) return 'soon';
  return 'ok';
}

export const completedDate = (t) =>
  t.completed && t.completedAt ? toDateStr(new Date(t.completedAt)) : null;

export function summarize(tasks, now = new Date()) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const sum = (list) => list.reduce((a, t) => a + (Number(t.duration) || 0), 0);
  return {
    total,
    completed,
    pending: total - completed,
    overdue: tasks.filter((t) => isOverdue(t, now)).length,
    pct: pct(completed, total),
    plannedMinutes: sum(tasks),
    doneMinutes: sum(tasks.filter((t) => t.completed)),
    pendingMinutes: sum(tasks.filter((t) => !t.completed)),
  };
}

/** Group by a task field (subject, priority, difficulty, type). */
export function groupStats(tasks, key, order) {
  const map = new Map();
  tasks.forEach((t) => {
    const k = t[key];
    const g = map.get(k) || { name: k, total: 0, completed: 0 };
    g.total += 1;
    if (t.completed) g.completed += 1;
    map.set(k, g);
  });
  const arr = [...map.values()].map((g) => ({
    ...g,
    pending: g.total - g.completed,
    pct: pct(g.completed, g.total),
  }));
  if (order) arr.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  else arr.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return arr;
}

/** Monday-to-Sunday activity: what was completed each day, and what was due. */
export function weekActivity(tasks, weekStart) {
  return DAY_NAMES.map((day, i) => {
    const date = addDays(weekStart, i);
    const done = tasks.filter((t) => completedDate(t) === date);
    return {
      day,
      date,
      completed: done.length,
      minutes: done.reduce((a, t) => a + (Number(t.duration) || 0), 0),
      due: tasks.filter((t) => t.dueDate === date).length,
    };
  });
}

export function weekStats(tasks, weekStart) {
  const end = addDays(weekStart, 6);
  const list = tasks.filter((t) => t.dueDate >= weekStart && t.dueDate <= end);
  return { ...summarize(list), tasks: list };
}

/** Consecutive days (ending today, or yesterday if nothing is done yet today) with >= 1 completion. */
export function streak(tasks, today = todayStr()) {
  const days = new Set(tasks.map(completedDate).filter(Boolean));
  let cur = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cur)) {
    count += 1;
    cur = addDays(cur, -1);
  }
  return { count, doneToday: days.has(today) };
}

export function dailyTrend(tasks, today = todayStr(), days = 14) {
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return {
      date,
      label: fmtDate(date, { day: 'numeric', month: 'short' }),
      completed: tasks.filter((t) => completedDate(t) === date).length,
    };
  });
}

/** Completion % of the tasks that were due in each of the last N weeks (Mondays). */
export function weeklyTrend(tasks, thisWeekStart, weeks = 6) {
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisWeekStart, (i - (weeks - 1)) * 7);
    const s = weekStats(tasks, start);
    return {
      label: fmtDate(start, { day: 'numeric', month: 'short' }),
      pct: s.pct,
      total: s.total,
      completed: s.completed,
    };
  });
}

export function onTimeLate(tasks) {
  let onTime = 0;
  let late = 0;
  tasks.forEach((t) => {
    if (!t.completed || !t.completedAt) return;
    if (new Date(t.completedAt) > dueDateTime(t)) late += 1;
    else onTime += 1;
  });
  return { onTime, late };
}

/** Things that need attention: overdue tasks plus subjects with the most pending work. */
export function attention(tasks, now = new Date()) {
  const overdueTasks = tasks
    .filter((t) => isOverdue(t, now))
    .sort((a, b) => dueDateTime(a) - dueDateTime(b));
  const subjects = groupStats(tasks, 'subject')
    .filter((s) => s.pending > 0)
    .map((s) => {
      const overdue = overdueTasks.filter((t) => t.subject === s.name).length;
      return { ...s, overdue, risk: overdue * 3 + s.pending * (100 - s.pct) / 100 };
    })
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 4);
  return { overdueTasks, subjects };
}
