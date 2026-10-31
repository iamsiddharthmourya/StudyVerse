export const PRIORITIES = ['High', 'Medium', 'Low'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export const TYPES = [
  { value: 'daily', label: 'Daily To-do' },
  { value: 'weekly', label: 'Weekly Task' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'exam', label: 'Exam' },
];
export const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));

export const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };
export const DIFF_WEIGHT = { Hard: 3, Medium: 2, Easy: 1 };

export const COLORS = {
  primary: '#7c5cff',
  teal: '#14b8a6',
  amber: '#f59e0b',
  rose: '#f43f5e',
  blue: '#3b82f6',
  slate: '#94a3b8',
};
export const PRIORITY_COLOR = { High: '#f43f5e', Medium: '#f59e0b', Low: '#14b8a6' };
export const DIFF_COLOR = { Hard: '#7c5cff', Medium: '#3b82f6', Easy: '#14b8a6' };
export const TYPE_COLOR = {
  daily: '#7c5cff',
  weekly: '#3b82f6',
  assignment: '#f59e0b',
  exam: '#f43f5e',
};
