// Centralised app state: tasks, weekly goals and settings for the signed-in user.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { loadData, normalize, saveData, writeLocal } from '../services/storage.js';
import { DEFAULT_SETTINGS, makeSampleGoals, makeSampleTasks, newId } from '../utils/sampleData.js';
import { cleanValues } from '../utils/validation.js';
import { startOfWeek, todayStr } from '../utils/dates.js';

const StoreContext = createContext(null);

const emptyState = { tasks: [], goals: [], settings: DEFAULT_SETTINGS };

function seedState(user) {
  const firstName = (user.name || '').split(' ')[0];
  return {
    tasks: makeSampleTasks(),
    goals: makeSampleGoals(startOfWeek(todayStr())),
    settings: { ...DEFAULT_SETTINGS, name: user.mode === 'guest' ? '' : firstName },
  };
}

function reducer(state, a) {
  switch (a.type) {
    case 'load':
      return a.state;
    case 'add':
      return { ...state, tasks: [...state.tasks, a.task] };
    case 'update':
      return { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, ...a.values, demo: false } : t)) };
    case 'delete':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== a.id) };
    case 'toggle':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === a.id
            ? { ...t, completed: !t.completed, completedAt: t.completed ? null : new Date().toISOString() }
            : t,
        ),
      };
    case 'goalAdd':
      return { ...state, goals: [...state.goals, a.goal] };
    case 'goalToggle':
      return { ...state, goals: state.goals.map((g) => (g.id === a.id ? { ...g, done: !g.done } : g)) };
    case 'goalDelete':
      return { ...state, goals: state.goals.filter((g) => g.id !== a.id) };
    case 'settings':
      return { ...state, settings: { ...state.settings, ...a.patch } };
    case 'clearDemo':
      return { ...state, tasks: state.tasks.filter((t) => !t.demo), goals: state.goals.filter((g) => !g.demo) };
    default:
      return state;
  }
}

export function StoreProvider({ user, children }) {
  const [state, dispatch] = useReducer(reducer, emptyState);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // saved | saving | error
  const stateRef = useRef(state);
  stateRef.current = state;
  const skipFirstSave = useRef(true);
  const timer = useRef(null);

  // Load this user's data (or seed demo data for a brand-new user).
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    skipFirstSave.current = true;
    (async () => {
      const { data, notice: n } = await loadData(user);
      if (cancelled) return;
      let initial = normalize(data);
      if (!initial) {
        initial = seedState(user);
        try {
          await saveData(user, initial);
        } catch (err) {
          console.error(err);
        }
        if (cancelled) return;
      }
      dispatch({ type: 'load', state: initial });
      setNotice(n);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user.uid, user.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save (debounced) whenever the data changes.
  useEffect(() => {
    if (!ready) return undefined;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return undefined;
    }
    setSaveStatus('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await saveData(user, stateRef.current);
        setSaveStatus('saved');
        setNotice('');
      } catch (err) {
        console.error('Save failed:', err);
        setSaveStatus('error');
      }
    }, 500);
    return () => clearTimeout(timer.current);
  }, [state, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Never lose the last change: write a local copy when the tab is hidden or the user signs out.
  useEffect(() => {
    const flush = () => {
      if (ready) writeLocal(user.uid, { ...stateRef.current, updatedAt: new Date().toISOString() });
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [ready, user.uid]);

  // Apply the theme.
  useEffect(() => {
    const theme = state.settings.theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('ssp:theme', theme);
    } catch {
      /* ignore */
    }
  }, [state.settings.theme]);

  const actions = useMemo(
    () => ({
      addTask: (values) => {
        const task = {
          id: newId('t'),
          demo: false,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
          ...cleanValues(values),
        };
        dispatch({ type: 'add', task });
        return task;
      },
      updateTask: (id, values) => dispatch({ type: 'update', id, values: cleanValues(values) }),
      moveTask: (id, dueDate) => dispatch({ type: 'update', id, values: { dueDate } }),
      deleteTask: (id) => dispatch({ type: 'delete', id }),
      toggleTask: (id) => dispatch({ type: 'toggle', id }),
      addGoal: (weekStart, text) => dispatch({ type: 'goalAdd', goal: { id: newId('goal'), demo: false, weekStart, text: text.trim(), done: false } }),
      toggleGoal: (id) => dispatch({ type: 'goalToggle', id }),
      deleteGoal: (id) => dispatch({ type: 'goalDelete', id }),
      updateSettings: (patch) => dispatch({ type: 'settings', patch }),
      clearDemo: () => dispatch({ type: 'clearDemo' }),
      clearAll: () => dispatch({ type: 'load', state: { ...stateRef.current, tasks: [], goals: [] } }),
      resetToDemo: () =>
        dispatch({
          type: 'load',
          state: { ...stateRef.current, tasks: makeSampleTasks(), goals: makeSampleGoals(startOfWeek(todayStr())) },
        }),
    }),
    [],
  );

  const retrySave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await saveData(user, stateRef.current);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [user]);

  const value = useMemo(
    () => ({ ...state, ...actions, ready, notice, saveStatus, retrySave, user }),
    [state, actions, ready, notice, saveStatus, retrySave, user],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
