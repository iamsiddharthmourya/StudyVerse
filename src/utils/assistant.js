// The local, rule-based study assistant.
//
// IMPORTANT: this is NOT an AI language model. It uses keyword matching, a tiny built-in
// topic glossary, and the transparent recommendation engine in recommend.js.
// To use a real model, see `askRemoteAI` at the bottom (it calls YOUR backend proxy, never
// a provider directly, so no secret key ever ships in the frontend).
import { buildPlan, rankTasks } from './recommend.js';
import { fmtDate, fmtDuration, diffDays, toDateStr, addDays } from './dates.js';
import { newId } from './sampleData.js';

export const QUICK_ACTIONS = [
  { id: 'plan', label: 'Suggest my study plan' },
  { id: 'exam', label: 'Help me prepare for an exam' },
  { id: 'explain', label: 'Explain a difficult topic' },
  { id: 'time', label: 'Help me manage my time' },
  { id: 'priority', label: 'What should I do first?' },
  { id: 'newtask', label: 'Create a task from chat' },
];

export const GLOSSARY = [
  { keys: ['backpropagation', 'backprop'], title: 'Backpropagation', text: 'Backpropagation is how a neural network learns. 1) Run the inputs forward to get a prediction. 2) Measure the error with a loss function. 3) Use the chain rule to work out how much each weight contributed to that error, moving backwards layer by layer. 4) Nudge every weight a little in the direction that reduces the error (gradient descent). Repeat over many examples.' },
  { keys: ['neural network', 'neural networks', 'perceptron'], title: 'Neural networks', text: 'A neural network is layers of simple units (neurons). Each neuron takes a weighted sum of its inputs, adds a bias and passes it through an activation function such as ReLU or sigmoid. Stacking layers lets the network learn complex patterns. Training adjusts the weights to reduce a loss.' },
  { keys: ['overfitting', 'underfitting', 'bias variance'], title: 'Overfitting', text: 'Overfitting means a model memorises the training data (including noise) and performs badly on new data. Signs: training accuracy is high, validation accuracy is low. Fixes: more data, a simpler model, regularisation, dropout, early stopping, cross-validation.' },
  { keys: ['linear regression', 'regression'], title: 'Linear regression', text: 'Linear regression fits a straight line y = w·x + b to the data by choosing w and b that minimise the mean squared error. It can be solved with the normal equation or with gradient descent. It assumes a roughly linear relationship between inputs and output.' },
  { keys: ['gradient descent'], title: 'Gradient descent', text: 'Gradient descent minimises a loss by repeatedly stepping against the gradient: w ← w − α·∂L/∂w. The learning rate α controls the step size: too large and training diverges, too small and it is very slow.' },
  { keys: ['knn', 'k nearest', 'k-nearest'], title: 'K-Nearest Neighbours', text: 'KNN classifies a point by looking at its k closest training points (usually by Euclidean distance) and taking a majority vote. There is no training step. Small k is noisy; large k is smooth. Scale your features first.' },
  { keys: ['normalization', 'normalisation', '1nf', '2nf', '3nf', 'bcnf'], title: 'Database normalization', text: 'Normalization removes redundancy. 1NF: every cell holds one atomic value. 2NF: 1NF plus no partial dependency on part of a composite key. 3NF: 2NF plus no transitive dependency (non-key attributes depend only on the key). BCNF: every determinant is a candidate key.' },
  { keys: ['sql join', 'join', 'joins'], title: 'SQL joins', text: 'INNER JOIN returns rows that match in both tables. LEFT JOIN returns all rows from the left table plus matches (NULL where none). RIGHT JOIN is the mirror image. FULL JOIN returns all rows from both. Always state the ON condition, or you get a cross product.' },
  { keys: ['deadlock'], title: 'Deadlock', text: 'A deadlock is when processes wait on each other forever. It needs all four Coffman conditions: mutual exclusion, hold and wait, no pre-emption, circular wait. Break any one (for example, ordering resource requests to prevent circular wait) to prevent it.' },
  { keys: ['process scheduling', 'cpu scheduling', 'round robin', 'fcfs', 'sjf'], title: 'CPU scheduling', text: 'FCFS runs in arrival order (simple, but long jobs block short ones). SJF runs the shortest job first (minimises average waiting time). Round Robin gives each process a fixed time quantum (fair, good for interactive systems). Priority scheduling runs the most important first (watch for starvation).' },
  { keys: ['binary tree', 'bst', 'binary search tree'], title: 'Binary search tree', text: 'In a BST, every node’s left subtree holds smaller keys and its right subtree larger keys. Search, insert and delete take O(h), where h is the height: O(log n) when balanced, O(n) when skewed. In-order traversal gives the keys in sorted order.' },
  { keys: ['stack', 'queue'], title: 'Stack vs queue', text: 'A stack is LIFO (last in, first out): push and pop at one end. A queue is FIFO (first in, first out): enqueue at the rear, dequeue from the front. Stacks suit undo and recursion; queues suit scheduling and BFS.' },
  { keys: ['big o', 'time complexity', 'complexity'], title: 'Time complexity', text: 'Big-O describes how running time grows with input size n, ignoring constants. Common orders: O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ). Count the loops: one loop over n is O(n); nested loops over n are O(n²).' },
  { keys: ['recursion'], title: 'Recursion', text: 'A recursive function solves a problem by calling itself on a smaller version. It needs a base case (when to stop) and a recursive case that moves towards it. Each call uses stack space, so very deep recursion can overflow.' },
  { keys: ['pointer'], title: 'Pointers', text: 'A pointer stores the memory address of another variable. In C, &x gives the address of x and *p reads the value at address p. Pointers allow dynamic memory and linked data structures; always initialise them and never use a freed one.' },
];

const has = (text, words) => words.some((w) => text.includes(w));

export function detectIntent(text) {
  const t = text.toLowerCase();
  if (has(t, ['create task', 'add task', 'add a task', 'new task', 'remind me to', 'schedule a task', 'make a task'])) return 'newtask';
  if (has(t, ['explain', 'what is', 'what are', 'how does', 'how do', 'define', 'meaning of', 'difference between', 'difficult topic'])) return 'explain';
  if (has(t, ['exam', 'test', 'quiz', 'revise', 'revision'])) return 'exam';
  if (has(t, ['pomodoro', 'time management', 'manage my time', 'break', 'focus', 'procrastinat', 'schedule my'])) return 'time';
  if (has(t, ['prioriti', 'first', 'urgent', 'important', 'what should i do', 'most important'])) return 'priority';
  if (has(t, ['plan', 'study plan', 'suggest', 'hours', 'minutes', 'free time'])) return 'plan';
  if (has(t, ['hello', 'hi ', 'hey', 'help'])) return 'help';
  return 'unknown';
}

/** Pull "2 hours", "90 minutes", "1.5h" out of text. Returns minutes or null. */
export function parseMinutes(text) {
  const t = text.toLowerCase();
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  const n = t.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  let total = 0;
  if (m) total += Math.round(parseFloat(m[1]) * 60);
  if (n) total += parseInt(n[1], 10);
  if (!m && !n) {
    const bare = t.match(/^\s*(\d{1,3})\s*$/);
    if (bare) return parseInt(bare[1], 10) <= 12 ? parseInt(bare[1], 10) * 60 : parseInt(bare[1], 10);
    return null;
  }
  return total > 0 ? Math.min(total, 960) : null;
}

export function formatPlan(plan) {
  if (!plan.blocks.length) return null;
  const lines = [];
  let clock = 0;
  plan.blocks.forEach((b) => {
    const start = clock;
    clock += b.minutes;
    const label = `${fmtDuration(start)}–${fmtDuration(clock)}`;
    if (b.kind === 'break') lines.push({ kind: 'break', label, text: `${b.minutes}-minute break (stretch, water, no screens)` });
    else lines.push({ kind: 'study', label, text: `${b.title}`, meta: `${b.subject} · ${b.minutes} min`, why: b.reasons.join(' · ') });
  });
  return lines;
}

function planReply(tasks, settings, minutes) {
  const available = minutes || settings.dailyMinutes;
  const plan = buildPlan(tasks, { available, session: settings.sessionMinutes, breakMin: settings.breakMinutes });
  if (!tasks.some((t) => !t.completed)) {
    return { text: 'You have no pending tasks, so there is nothing to schedule. Add a task from the Add Task page or tell me what you want to study.' };
  }
  const rows = formatPlan(plan);
  if (!rows) return { text: `With ${fmtDuration(available)} I could not fit a study block. Try giving me at least 15 minutes.` };
  const unscheduled = plan.notCovered.length;
  const partial = plan.covered.filter((c) => c.allocated < c.of);
  let text = `Here is a plan for ${fmtDuration(available)}: ${fmtDuration(plan.studyMinutes)} of study and ${fmtDuration(plan.breakMinutes)} of breaks. Tasks are ranked by deadline, priority and difficulty (a simple scoring rule, not machine learning).`;
  if (partial.length) text += ` ${partial.length} task(s) are only partly covered, so continue them next session.`;
  if (unscheduled) text += ` ${unscheduled} lower-ranked task(s) do not fit today.`;
  return { text, plan: rows };
}

function priorityReply(tasks) {
  const ranked = rankTasks(tasks).slice(0, 4);
  if (!ranked.length) return { text: 'Nothing is pending. Enjoy the break, or plan ahead by adding upcoming tasks.' };
  return {
    text: 'Here is what I would do first, and why. The score adds points for how close the deadline is (overdue counts most), then priority, then difficulty.',
    ranked: ranked.map((r) => ({ title: r.task.title, subject: r.task.subject, score: r.score, reasons: r.reasons })),
  };
}

function timeReply(settings) {
  const s = settings.sessionMinutes;
  const b = settings.breakMinutes;
  const long = Math.max(b * 2, 20);
  return {
    text: `Using your settings, work in ${s}-minute focus sessions with ${b}-minute breaks, and take a longer ${long}-minute break after every 3–4 sessions. Hard subjects work better in shorter sessions (about ${Math.round((s * 0.75) / 5) * 5} minutes).`,
    tips: [
      'Start with the hardest task while your energy is highest.',
      'Put your phone out of reach during focus blocks.',
      'Write the single goal of each session before you begin.',
      'During breaks: stand, stretch, drink water. Avoid starting new videos.',
      `Your daily budget is ${fmtDuration(settings.dailyMinutes)}, so aim for about ${Math.max(1, Math.floor(settings.dailyMinutes / (s + b)))} sessions.`,
    ],
  };
}

function examReply(tasks, settings, now) {
  const today = toDateStr(now);
  const exams = tasks.filter((t) => t.type === 'exam' && !t.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (!exams.length) return { text: 'You have no upcoming exams saved. Add one on the Exams & Assignments page (with its syllabus in the notes) and I will build a revision plan from it.' };
  const exam = exams[0];
  const days = Math.max(0, diffDays(exam.dueDate, today));
  const topics = (exam.notes || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const revisionDays = Math.max(1, days);
  const proposals = [];
  if (topics.length) {
    const perDay = Math.max(1, Math.ceil(topics.length / Math.max(1, revisionDays - 1)));
    for (let i = 0; i < topics.length; i += perDay) {
      const group = topics.slice(i, i + perDay);
      // Spread revision over the days before the exam, never later than the day before it (or today).
      const lastDay = addDays(exam.dueDate, -1) >= today ? addDays(exam.dueDate, -1) : today;
      const wanted = addDays(today, Math.floor(i / perDay));
      const day = wanted < lastDay ? wanted : lastDay;
      proposals.push({
        id: newId('prop'),
        title: `Revise: ${group.join(', ')}`,
        subject: exam.subject,
        type: 'daily',
        dueDate: day,
        dueTime: '19:00',
        priority: 'High',
        difficulty: exam.difficulty,
        duration: Math.min(120, Math.max(30, group.length * 35)),
        goal: exam.title,
        notes: `Revision for ${exam.title}`,
      });
    }
  }
  const text = days === 0
    ? `${exam.title} is today. Do a light revision of key formulas and definitions only, and rest.`
    : `${exam.title} is in ${days} day${days === 1 ? '' : 's'} (${fmtDate(exam.dueDate)}). ${topics.length ? `Based on the ${topics.length} syllabus topic(s) you entered, here is a suggested revision schedule you can approve.` : 'You have not entered syllabus topics in the exam notes, so I cannot split the revision. Edit the exam and list topics separated by commas.'}`;
  return { text, proposals, tips: ['Revise the hardest topics first, then attempt past questions.', 'Spend the last day on summary notes, not new material.'] };
}

function explainReply(text) {
  const t = text.toLowerCase();
  const hit = GLOSSARY.find((g) => g.keys.some((k) => t.includes(k)));
  if (hit) return { text: hit.text, topic: hit.title, local: true };
  return {
    text: 'I only have a small built-in glossary (machine learning, databases, operating systems, data structures basics), and this topic is not in it. The local assistant is not a real AI model, so I will not guess. Ask your textbook or lecturer, or connect a real AI API (see the README) for open-ended explanations.',
    local: true,
    suggestions: GLOSSARY.slice(0, 6).map((g) => g.title),
  };
}

/** Try to read a task out of free text: "add task read chapter 4 of OS tomorrow 45 min high". */
export function parseTaskFromText(text, now = new Date(), defaults = {}) {
  const today = toDateStr(now);
  const t = text.trim();
  let title = t.replace(/^(please\s+)?(create|add|make|schedule)\s+(a\s+)?(new\s+)?task\s*(to|for|:)?\s*/i, '').replace(/^remind me to\s*/i, '');
  let dueDate = today;
  if (/\btomorrow\b/i.test(t)) dueDate = addDays(today, 1);
  const inDays = t.match(/\bin (\d+) days?\b/i);
  if (inDays) dueDate = addDays(today, parseInt(inDays[1], 10));
  const priority = /\b(high|urgent)\b/i.test(t) ? 'High' : /\blow\b/i.test(t) ? 'Low' : 'Medium';
  const difficulty = /\bhard\b/i.test(t) ? 'Hard' : /\beasy\b/i.test(t) ? 'Easy' : 'Medium';
  const duration = parseMinutes(t.replace(title, '')) || 45;
  title = title.replace(/\b(tomorrow|today|in \d+ days?|high|low|urgent|hard|easy|priority)\b/gi, '').replace(/\d+(?:\.\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
  if (!title) return null;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return {
    id: newId('prop'),
    title: title.slice(0, 100),
    subject: defaults.subject || 'General',
    type: 'daily',
    dueDate,
    dueTime: '19:00',
    priority,
    difficulty,
    duration: Math.min(720, Math.max(5, duration)),
    goal: '',
    notes: 'Created from the study assistant chat',
  };
}

/**
 * Main entry. `ctx` = { tasks, settings, now, pending } where `pending` is a follow-up state
 * returned by a previous reply (for example "I asked how much time you have").
 */
export function respond(input, ctx) {
  const { tasks, settings, now = new Date(), pending } = ctx;
  const text = input.trim();

  if (pending === 'plan-time') {
    const mins = parseMinutes(text);
    if (mins) return { ...planReply(tasks, settings, mins), source: 'local' };
    return { text: 'I could not read a time from that. Try something like "90 minutes" or "2 hours".', pending: 'plan-time', source: 'local' };
  }
  if (pending === 'explain-topic') return { ...explainReply(text), source: 'local' };
  if (pending === 'newtask-text') {
    const p = parseTaskFromText(text, now);
    if (!p) return { text: 'I could not find a task title in that. Try: "Read chapter 4 of OS tomorrow 45 min high".', pending: 'newtask-text', source: 'local' };
    return { text: 'I drafted this task. Review it and choose Add or Dismiss. Nothing is saved until you approve.', proposals: [p], source: 'local' };
  }

  switch (detectIntent(text)) {
    case 'newtask': {
      const p = parseTaskFromText(text, now);
      if (p && p.title.length > 3 && !/^(a )?(new )?task$/i.test(p.title)) return { text: 'I drafted this task from your message. Review it and choose Add or Dismiss. Nothing is saved until you approve.', proposals: [p], source: 'local' };
      return { text: 'Sure. Describe the task in one line, for example "Read chapter 4 of OS tomorrow 45 min high".', pending: 'newtask-text', source: 'local' };
    }
    case 'explain': {
      const hit = GLOSSARY.find((g) => g.keys.some((k) => text.toLowerCase().includes(k)));
      if (hit) return { ...explainReply(text), source: 'local' };
      // A specific topic was named but is not in the glossary: say so honestly instead of asking again.
      const generic = /difficult topic|a topic|something/i.test(text) || text.split(/\s+/).length <= 2;
      if (!generic) return { ...explainReply(text), source: 'local' };
      return { text: 'Which topic should I explain? For example: backpropagation, SQL joins, deadlock, binary search tree.', pending: 'explain-topic', source: 'local' };
    }
    case 'exam': return { ...examReply(tasks, settings, now), source: 'local' };
    case 'time': return { ...timeReply(settings), source: 'local' };
    case 'priority': return { ...priorityReply(tasks), source: 'local' };
    case 'plan': {
      const mins = parseMinutes(text);
      if (mins) return { ...planReply(tasks, settings, mins), source: 'local' };
      return { text: `How much time do you have to study? (For example "90 minutes" or "2 hours".) Your default budget is ${fmtDuration(settings.dailyMinutes)}.`, pending: 'plan-time', source: 'local' };
    }
    case 'help':
      return { text: 'Hi! I can build a study plan from your real tasks, help you prepare for an exam, explain a few core topics, suggest a time-management routine, rank what to do first, or draft a task for you to approve. Pick a quick action below or just type.', source: 'local' };
    default: {
      const hit = GLOSSARY.find((g) => g.keys.some((k) => text.toLowerCase().includes(k)));
      if (hit) return { ...explainReply(text), source: 'local' };
      return { text: 'I did not quite understand that. I can: suggest a study plan, prepare you for an exam, explain a topic from my small glossary, manage your time, prioritise tasks, or create a task. Try one of the quick actions.', source: 'local' };
    }
  }
}

export const AI_PROXY_URL = import.meta.env?.VITE_AI_PROXY_URL || '';

/**
 * OPTIONAL hook for a real AI model. Point VITE_AI_PROXY_URL at a backend you control (for
 * example a Firebase Cloud Function) that holds the provider key server-side and returns
 * { reply: string }. The API key must never be placed in this frontend code.
 */
export async function askRemoteAI(message, context) {
  if (!AI_PROXY_URL) throw new Error('No AI proxy configured');
  const res = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, context }),
  });
  if (!res.ok) throw new Error(`AI service error (${res.status})`);
  const data = await res.json();
  if (typeof data.reply !== 'string') throw new Error('Unexpected AI response');
  return data.reply;
}
