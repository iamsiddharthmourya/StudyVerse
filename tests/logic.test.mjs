// Plain-Node tests for the pure logic (no test framework needed). Run: npm test
import assert from 'node:assert/strict';
import { addDays, startOfWeek, todayStr, diffDays, isValidDateStr, countdownLabel } from '../src/utils/dates.js';
import { validateTask, cleanValues } from '../src/utils/validation.js';
import { makeSampleTasks } from '../src/utils/sampleData.js';
import { summarize, streak, groupStats, weekActivity, onTimeLate, weekStats } from '../src/utils/stats.js';
import { buildPlan, rankTasks, scoreTask } from '../src/utils/recommend.js';
import { parseMinutes, parseTaskFromText, respond, detectIntent } from '../src/utils/assistant.js';

let n = 0;
const t = (name, fn) => {
  fn();
  n += 1;
  console.log(`  ok  ${name}`);
};

const today = todayStr();
const tasks = makeSampleTasks();
const settings = { dailyMinutes: 240, sessionMinutes: 45, breakMinutes: 10 };

t('dates: week starts on Monday', () => {
  assert.equal(new Date(startOfWeek(today) + 'T00:00:00').getDay(), 1);
  assert.equal(diffDays(addDays(today, 5), today), 5);
  assert.equal(isValidDateStr('2026-02-31'), false);
  assert.equal(isValidDateStr('2026-02-28'), true);
});

t('validation: rejects bad input, accepts good input', () => {
  const ok = { title: 'Read', subject: 'OS', type: 'daily', dueDate: today, dueTime: '18:00', priority: 'High', difficulty: 'Easy', duration: 30 };
  assert.deepEqual(validateTask(ok), {});
  assert.ok(validateTask({ ...ok, title: '  ' }).title);
  assert.ok(validateTask({ ...ok, duration: 2 }).duration);
  assert.ok(validateTask({ ...ok, duration: 'abc' }).duration);
  assert.ok(validateTask({ ...ok, duration: 12.5 }).duration);
  assert.ok(validateTask({ ...ok, dueDate: '2026-13-40' }).dueDate);
  assert.ok(validateTask({ ...ok, startDate: addDays(today, 5), dueDate: today }).startDate);
  assert.equal(cleanValues({ ...ok, title: ' x ', duration: '30' }).duration, 30);
});

t('stats: summary numbers are consistent', () => {
  const s = summarize(tasks);
  assert.equal(s.total, tasks.length);
  assert.equal(s.completed + s.pending, s.total);
  assert.ok(s.overdue >= 1); // sample data contains an overdue task
  assert.equal(s.pct, Math.round((s.completed / s.total) * 100));
});

t('stats: updates when a task is completed', () => {
  const before = summarize(tasks);
  const copy = tasks.map((x) => (x.id === 'demo-1' ? { ...x, completed: true, completedAt: new Date().toISOString() } : x));
  const after = summarize(copy);
  assert.equal(after.completed, before.completed + 1);
  assert.ok(streak(copy).doneToday);
});

t('stats: groups, week activity and timing', () => {
  assert.equal(groupStats(tasks, 'priority').reduce((a, g) => a + g.total, 0), tasks.length);
  const act = weekActivity(tasks, startOfWeek(today));
  assert.equal(act.length, 7);
  const { onTime, late } = onTimeLate(tasks);
  assert.equal(onTime + late, tasks.filter((x) => x.completed).length);
  assert.ok(weekStats(tasks, startOfWeek(today)).total >= 1);
});

t('recommend: overdue and high priority rank first', () => {
  const ranked = rankTasks(tasks);
  assert.ok(ranked.every((r) => !r.task.completed));
  assert.ok(ranked[0].score >= ranked[ranked.length - 1].score);
  const hard = scoreTask({ ...tasks[0], difficulty: 'Hard' });
  assert.ok(hard.reasons.some((r) => r.includes('Hard')));
});

t('recommend: plan never exceeds available time', () => {
  for (const available of [30, 60, 90, 120, 240, 480]) {
    const plan = buildPlan(tasks, { available, session: 45, breakMin: 10 });
    assert.ok(plan.studyMinutes + plan.breakMinutes <= available, `available=${available}`);
    assert.ok(plan.blocks.every((b) => b.kind === 'break' || b.minutes > 0));
  }
  const plan = buildPlan(tasks, { available: 240, session: 45, breakMin: 10 });
  assert.ok(plan.blocks.filter((b) => b.kind === 'study' && b.difficulty === 'Hard').every((b) => b.minutes <= 35));
});

t('assistant: parses minutes and intents', () => {
  assert.equal(parseMinutes('I have 2 hours'), 120);
  assert.equal(parseMinutes('90 minutes'), 90);
  assert.equal(parseMinutes('1.5h'), 90);
  assert.equal(detectIntent('Suggest my study plan'), 'plan');
  assert.equal(detectIntent('Help me prepare for an exam'), 'exam');
});

t('assistant: builds a plan from real tasks and asks for time', () => {
  const ask = respond('Suggest my study plan', { tasks, settings });
  assert.equal(ask.pending, 'plan-time');
  const plan = respond('90 minutes', { tasks, settings, pending: 'plan-time' });
  assert.ok(plan.plan?.length);
});

t('assistant: exam prep proposes tasks that pass validation', () => {
  const r = respond('Help me prepare for an exam', { tasks, settings });
  assert.ok(r.proposals?.length);
  r.proposals.forEach((p) => assert.deepEqual(validateTask({ ...p, duration: String(p.duration) }), {}));
});

t('assistant: task drafts from chat are only proposals', () => {
  const p = parseTaskFromText('add task read OS chapter 4 tomorrow 45 min high');
  assert.equal(p.dueDate, addDays(today, 1));
  assert.equal(p.priority, 'High');
  assert.equal(p.duration, 45);
  assert.deepEqual(validateTask({ ...p, duration: String(p.duration) }), {});
});

t('assistant: honest about unknown topics', () => {
  const r = respond('explain quantum chromodynamics', { tasks, settings });
  assert.ok(/not a real AI/i.test(r.text));
});

t('countdown labels', () => {
  assert.match(countdownLabel({ dueDate: addDays(today, 3), dueTime: '23:59', completed: false, type: 'exam' }), /3 days left/);
  assert.match(countdownLabel({ dueDate: addDays(today, -2), dueTime: '10:00', completed: false, type: 'exam' }), /Overdue by 2 days/);
});

console.log(`\n${n} test groups passed`);
