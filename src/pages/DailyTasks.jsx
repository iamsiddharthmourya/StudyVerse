import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ListTodo, Plus, Search } from 'lucide-react';
import { useStore } from '../state/store.jsx';
import { useTaskEditor } from '../components/TaskEditor.jsx';
import { EmptyState, PageHeader, ProgressBar, Segmented } from '../components/ui.jsx';
import TaskItem from '../components/TaskItem.jsx';
import { addDays, dueDateTime, fmtDate, todayStr } from '../utils/dates.js';
import { isOverdue } from '../utils/stats.js';
import { DIFF_WEIGHT, PRIORITY_WEIGHT } from '../utils/constants.js';

const SORTS = {
  priority: (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || dueDateTime(a) - dueDateTime(b),
  deadline: (a, b) => dueDateTime(a) - dueDateTime(b),
  difficulty: (a, b) => DIFF_WEIGHT[b.difficulty] - DIFF_WEIGHT[a.difficulty] || dueDateTime(a) - dueDateTime(b),
};

export default function DailyTasks() {
  const { tasks } = useStore();
  const { openTask } = useTaskEditor();
  const today = todayStr();
  const [date, setDate] = useState(today);
  const [allDates, setAllDates] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('priority');
  const [query, setQuery] = useState('');

  const { base, list, counts, pct, doneCount, earlierOverdue } = useMemo(() => {
    const now = new Date();
    const b = tasks.filter((t) => allDates || t.dueDate === date);
    const q = query.trim().toLowerCase();
    const searched = q ? b.filter((t) => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)) : b;
    const match = {
      all: () => true,
      pending: (t) => !t.completed,
      completed: (t) => t.completed,
      overdue: (t) => isOverdue(t, now),
    };
    const done = b.filter((t) => t.completed).length;
    return {
      base: b,
      list: searched.filter(match[filter]).sort(SORTS[sort]),
      counts: {
        all: searched.length,
        pending: searched.filter(match.pending).length,
        completed: searched.filter(match.completed).length,
        overdue: searched.filter(match.overdue).length,
      },
      pct: b.length ? Math.round((done / b.length) * 100) : 0,
      doneCount: done,
      earlierOverdue: tasks.filter((t) => isOverdue(t, now) && t.dueDate < today).length,
    };
  }, [tasks, date, allDates, filter, sort, query, today]);

  const heading = allDates ? 'All dates' : date === today ? 'Today' : fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="stack-lg">
      <PageHeader
        title="Daily Tasks"
        subtitle="Your to-do list for the selected day."
        actions={
          <button className="btn primary" onClick={() => openTask({ defaults: { dueDate: allDates ? today : date } })}>
            <Plus size={16} aria-hidden="true" /> Add task
          </button>
        }
      />

      <div className="card toolbar">
        <div className="date-nav">
          <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} disabled={allDates}>
            <ChevronLeft size={18} />
          </button>
          <label className="sr-only" htmlFor="day-picker">Choose a date</label>
          <input id="day-picker" type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} disabled={allDates} />
          <button className="icon-btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))} disabled={allDates}>
            <ChevronRight size={18} />
          </button>
          <button className="btn ghost sm" onClick={() => setDate(today)} disabled={allDates || date === today}>
            Today
          </button>
          <label className="check-inline">
            <input type="checkbox" checked={allDates} onChange={(e) => setAllDates(e.target.checked)} /> All dates
          </label>
        </div>

        <div className="search">
          <Search size={16} aria-hidden="true" />
          <label className="sr-only" htmlFor="task-search">Search tasks</label>
          <input id="task-search" className="input" placeholder="Search by task or subject" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="sort">
          <label htmlFor="sort-by" className="muted small">Sort by</label>
          <select id="sort-by" className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="priority">Priority</option>
            <option value="deadline">Deadline</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </div>
      </div>

      <div className="card">
        <div className="progress-head">
          <div>
            <h2>{heading}</h2>
            <p className="muted small">
              {doneCount} of {base.length} task{base.length === 1 ? '' : 's'} completed
            </p>
          </div>
          <div className="big-pct sm">{pct}%</div>
        </div>
        <ProgressBar value={pct} label="Daily completion" height={10} />
      </div>

      {date === today && !allDates && earlierOverdue > 0 && (
        <div className="banner warn" role="status">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            You have {earlierOverdue} overdue task{earlierOverdue === 1 ? '' : 's'} from earlier days.
          </span>
          <button
            className="btn ghost sm"
            onClick={() => {
              setAllDates(true);
              setFilter('overdue');
            }}
          >
            Show them
          </button>
        </div>
      )}

      <Segmented
        label="Filter tasks"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'pending', label: 'Pending', count: counts.pending },
          { value: 'completed', label: 'Completed', count: counts.completed },
          { value: 'overdue', label: 'Overdue', count: counts.overdue },
        ]}
      />

      {list.length ? (
        <div className="task-list">
          {list.map((t) => (
            <TaskItem key={t.id} task={t} showDate={allDates || t.type !== 'daily'} />
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={ListTodo}
            title={tasks.length === 0 ? 'No tasks yet' : query || filter !== 'all' ? 'No tasks match your filters' : 'Nothing planned for this day'}
            text={tasks.length === 0 ? 'Create your first task to start planning.' : query || filter !== 'all' ? 'Try clearing the search or choosing a different filter.' : 'Enjoy the free time, or add a task for this day.'}
            action={
              <button className="btn primary" onClick={() => openTask({ defaults: { dueDate: allDates ? today : date } })}>
                <Plus size={16} aria-hidden="true" /> Add task
              </button>
            }
          />
        </div>
      )}
    </div>
  );
}
