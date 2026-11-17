import { isValidDateStr } from './dates.js';
import { PRIORITIES, DIFFICULTIES, TYPES } from './constants.js';

/** Returns an object of { field: message }. Empty object = valid. */
export function validateTask(v) {
  const e = {};
  const title = (v.title || '').trim();
  if (!title) e.title = 'Task title is required.';
  else if (title.length > 100) e.title = 'Keep the title under 100 characters.';

  if (!(v.subject || '').trim()) e.subject = 'Subject is required.';
  else if (v.subject.trim().length > 60) e.subject = 'Keep the subject under 60 characters.';

  if (!TYPES.some((t) => t.value === v.type)) e.type = 'Choose a task type.';

  if (!v.dueDate) e.dueDate = 'Due date is required.';
  else if (!isValidDateStr(v.dueDate)) e.dueDate = 'Enter a valid date.';
  else {
    const year = Number(v.dueDate.slice(0, 4));
    if (year < 2000 || year > 2100) e.dueDate = 'Choose a date between 2000 and 2100.';
  }

  if (!v.dueTime) e.dueTime = 'Due time is required.';
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.dueTime)) e.dueTime = 'Enter a valid time.';

  if (v.startDate) {
    if (!isValidDateStr(v.startDate)) e.startDate = 'Enter a valid start date.';
    else if (v.dueDate && isValidDateStr(v.dueDate) && v.startDate > v.dueDate)
      e.startDate = 'Start date cannot be after the due date.';
  }

  if (!PRIORITIES.includes(v.priority)) e.priority = 'Choose a priority.';
  if (!DIFFICULTIES.includes(v.difficulty)) e.difficulty = 'Choose a difficulty.';

  const raw = String(v.duration ?? '').trim();
  const d = Number(raw);
  if (raw === '' || !Number.isFinite(d)) e.duration = 'Enter the estimated duration in minutes.';
  else if (!Number.isInteger(d)) e.duration = 'Use whole minutes (for example 45).';
  else if (d < 5 || d > 720) e.duration = 'Duration must be between 5 and 720 minutes.';

  if ((v.notes || '').length > 1000) e.notes = 'Notes can be up to 1000 characters.';
  if ((v.goal || '').length > 100) e.goal = 'Keep the goal under 100 characters.';
  return e;
}

/** Turn validated form values into the stored task fields. */
export function cleanValues(v) {
  return {
    title: v.title.trim(),
    subject: v.subject.trim(),
    type: v.type,
    notes: (v.notes || '').trim(),
    goal: (v.goal || '').trim(),
    startDate: v.startDate || '',
    dueDate: v.dueDate,
    dueTime: v.dueTime,
    priority: v.priority,
    difficulty: v.difficulty,
    duration: Number(v.duration),
  };
}
