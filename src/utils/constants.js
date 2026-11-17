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
  primary: '#00BFA6',
  teal: '#00BFA6',
  cyan: '#22D3EE',
  amber: '#f59e0b',
  rose: '#f43f5e',
  blue: '#38bdf8',
  slate: '#a8b8b8',
};
export const PRIORITY_COLOR = { High: '#f43f5e', Medium: '#f59e0b', Low: '#00bfa6' };
export const DIFF_COLOR = { Hard: '#22d3ee', Medium: '#00bfa6', Easy: '#38bdf8' };
export const TYPE_COLOR = {
  daily: '#00bfa6',
  weekly: '#22d3ee',
  assignment: '#f59e0b',
  exam: '#f43f5e',
};
