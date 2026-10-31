// Date helpers. All dates are local "YYYY-MM-DD" strings so there are no time-zone surprises.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const todayStr = () => toDateStr(new Date());

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Monday of the week that contains the date. */
export function startOfWeek(s) {
  const d = parseDate(s);
  const weekday = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - weekday);
  return toDateStr(d);
}

export const weekDays = (s) => {
  const start = startOfWeek(s);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Whole days from b to a (a - b). */
export const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateStr(parseDate(s)) === s;
}

export const dueDateTime = (t) => new Date(`${t.dueDate}T${t.dueTime || '23:59'}:00`);

export function fmtDate(s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseDate(s).toLocaleDateString('en-IN', opts);
}

export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${suffix}`;
}

export function fmtDuration(min) {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** 42 date strings (6 weeks, Monday first) covering the given month. month is 0-11. */
export function monthGrid(year, month) {
  const first = toDateStr(new Date(year, month, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Human countdown such as "3 days left", "Due today", "Overdue by 2 days". */
export function countdownLabel(task, now = new Date()) {
  const today = toDateStr(now);
  const days = diffDays(task.dueDate, today);
  if (task.completed) return task.type === 'assignment' ? 'Submitted' : 'Completed';
  if (dueDateTime(task) < now) {
    const late = Math.max(0, -days);
    return late === 0 ? 'Overdue (due earlier today)' : `Overdue by ${late} day${late === 1 ? '' : 's'}`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}
