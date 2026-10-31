// Demo data. Dates are generated relative to "today" so the app always looks populated.
import { addDays, todayStr } from './dates.js';

export const DEFAULT_SETTINGS = {
  name: '',
  course: 'B.Tech CSE (AIML)',
  dailyMinutes: 240,
  sessionMinutes: 45,
  breakMinutes: 10,
  weeklyGoalPct: 80,
  theme: 'dark',
};

let counter = 0;
export const newId = (prefix = 't') =>
  `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** completedAt helper: an ISO timestamp `daysAgo` days back at the given hour. */
function doneAt(daysAgo, hour = 18) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

export function makeSampleTasks() {
  const t = todayStr();
  const mk = (i, o) => ({
    id: `demo-${i}`,
    demo: true,
    notes: '',
    goal: '',
    startDate: '',
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
    ...o,
  });

  return [
    // ---- Today ----
    mk(1, { title: 'Revise Neural Networks – backpropagation', subject: 'Machine Learning', type: 'daily', dueDate: t, dueTime: '20:00', priority: 'High', difficulty: 'Hard', duration: 60, goal: 'Unit 3: Neural Networks', notes: 'Work through the chain-rule derivation by hand.' }),
    mk(2, { title: 'Solve 10 SQL join problems', subject: 'Database Systems', type: 'daily', dueDate: t, dueTime: '18:00', priority: 'Medium', difficulty: 'Medium', duration: 45 }),
    mk(3, { title: 'Read OS chapter on deadlocks', subject: 'Operating Systems', type: 'daily', dueDate: t, dueTime: '21:30', priority: 'Low', difficulty: 'Easy', duration: 30 }),
    mk(4, { title: 'Morning revision – Python lists & dicts', subject: 'Python', type: 'daily', dueDate: t, dueTime: '09:00', priority: 'Medium', difficulty: 'Easy', duration: 25, completed: true, completedAt: doneAt(0, 8) }),

    // ---- Overdue ----
    mk(5, { title: 'Complete DSA practice sheet – trees', subject: 'Data Structures', type: 'daily', dueDate: addDays(t, -2), dueTime: '20:00', priority: 'High', difficulty: 'Hard', duration: 90, goal: 'Binary trees & BSTs' }),

    // ---- Upcoming weekly tasks ----
    mk(6, { title: 'Implement linear regression from scratch', subject: 'Machine Learning', type: 'weekly', dueDate: addDays(t, 2), dueTime: '17:00', priority: 'High', difficulty: 'Medium', duration: 75 }),
    mk(7, { title: 'Prepare ER diagram for library system', subject: 'Database Systems', type: 'weekly', dueDate: addDays(t, 3), dueTime: '16:00', priority: 'Medium', difficulty: 'Medium', duration: 60 }),
    mk(8, { title: 'Watch lecture – Process scheduling', subject: 'Operating Systems', type: 'weekly', dueDate: addDays(t, 4), dueTime: '19:00', priority: 'Low', difficulty: 'Easy', duration: 40 }),

    // ---- Assignments ----
    mk(9, { title: 'DBMS Assignment 2 – Normalization', subject: 'Database Systems', type: 'assignment', dueDate: addDays(t, 2), dueTime: '23:00', priority: 'High', difficulty: 'Medium', duration: 90, notes: 'Submit as PDF on the college portal.' }),
    mk(10, { title: 'ML Lab report – KNN classifier', subject: 'Machine Learning', type: 'assignment', dueDate: addDays(t, 6), dueTime: '17:00', priority: 'Medium', difficulty: 'Medium', duration: 80, notes: 'Include confusion matrix and accuracy table.' }),
    mk(11, { title: 'Python mini-project submission', subject: 'Python', type: 'assignment', dueDate: addDays(t, -1), dueTime: '12:00', priority: 'High', difficulty: 'Medium', duration: 120, completed: true, completedAt: doneAt(2, 11) }),

    // ---- Exams ----
    mk(12, { title: 'Data Structures Mid-Sem Exam', subject: 'Data Structures', type: 'exam', dueDate: addDays(t, 7), dueTime: '10:00', priority: 'High', difficulty: 'Hard', duration: 120, notes: 'Arrays, linked lists, stacks, queues, trees, graphs', goal: 'Units 1–4' }),
    mk(13, { title: 'Operating Systems Quiz', subject: 'Operating Systems', type: 'exam', dueDate: addDays(t, 4), dueTime: '11:00', priority: 'Medium', difficulty: 'Medium', duration: 60, notes: 'Processes, threads, CPU scheduling, deadlocks' }),
    mk(14, { title: 'Python Unit Test', subject: 'Python', type: 'exam', dueDate: addDays(t, -5), dueTime: '10:00', priority: 'Medium', difficulty: 'Easy', duration: 60, completed: true, completedAt: doneAt(5, 11), notes: 'Functions, OOP, file handling' }),

    // ---- Completed history (feeds streak and trends) ----
    mk(15, { title: 'Revise stack & queue operations', subject: 'Data Structures', type: 'daily', dueDate: addDays(t, -1), dueTime: '19:00', priority: 'Medium', difficulty: 'Medium', duration: 45, completed: true, completedAt: doneAt(1, 18) }),
    mk(16, { title: 'Practice normalization examples', subject: 'Database Systems', type: 'daily', dueDate: addDays(t, -2), dueTime: '19:00', priority: 'Medium', difficulty: 'Medium', duration: 40, completed: true, completedAt: doneAt(2, 17) }),
    mk(17, { title: 'Read intro to supervised learning', subject: 'Machine Learning', type: 'daily', dueDate: addDays(t, -3), dueTime: '19:00', priority: 'Low', difficulty: 'Easy', duration: 30, completed: true, completedAt: doneAt(3, 16) }),
    mk(18, { title: 'Solve array problems', subject: 'Data Structures', type: 'daily', dueDate: addDays(t, -4), dueTime: '19:00', priority: 'High', difficulty: 'Medium', duration: 60, completed: true, completedAt: doneAt(3, 20) }),
    mk(19, { title: 'OS notes – memory management', subject: 'Operating Systems', type: 'daily', dueDate: addDays(t, -6), dueTime: '19:00', priority: 'Low', difficulty: 'Easy', duration: 35, completed: true, completedAt: doneAt(6, 18) }),
    mk(20, { title: 'ML weekly quiz prep', subject: 'Machine Learning', type: 'weekly', dueDate: addDays(t, -8), dueTime: '19:00', priority: 'Medium', difficulty: 'Medium', duration: 50, completed: true, completedAt: doneAt(8, 21) }),
    mk(21, { title: 'DBMS lab record', subject: 'Database Systems', type: 'assignment', dueDate: addDays(t, -9), dueTime: '15:00', priority: 'Medium', difficulty: 'Easy', duration: 60, completed: true, completedAt: doneAt(10, 14) }),
  ];
}

export const SAMPLE_NOTE = 'Demo data: sample tasks are marked and can be deleted at any time from Settings.';

export function makeSampleGoals(weekStart) {
  return [
    { id: 'goal-demo-1', demo: true, weekStart, text: 'Finish DBMS Assignment 2', done: false },
    { id: 'goal-demo-2', demo: true, weekStart, text: 'Revise 2 units for the DSA mid-sem', done: false },
    { id: 'goal-demo-3', demo: true, weekStart, text: 'Solve 20 SQL practice problems', done: true },
  ];
}
