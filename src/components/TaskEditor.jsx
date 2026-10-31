// A single "add / edit task" dialog that any page can open with useTaskEditor().openTask(...)
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, useUI } from './ui.jsx';
import TaskForm from './TaskForm.jsx';
import { useStore } from '../state/store.jsx';

const EditorContext = createContext(null);
export const useTaskEditor = () => useContext(EditorContext);

export function TaskEditorProvider({ children }) {
  const { addTask, updateTask } = useStore();
  const { toast } = useUI();
  const [state, setState] = useState(null); // { task?, defaults?, lockType? }

  const openTask = useCallback((opts = {}) => setState(opts), []);
  const close = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ openTask }), [openTask]);

  const editing = state?.task;
  const initial = editing
    ? { ...editing, duration: String(editing.duration) }
    : state?.defaults;

  const onSubmit = (values) => {
    if (editing) {
      updateTask(editing.id, values);
      toast('Task updated.');
    } else {
      addTask(values);
      toast('Task added to your planner.');
    }
    close();
  };

  const kind = state?.defaults?.type || editing?.type;
  const noun = kind === 'exam' ? 'exam' : kind === 'assignment' ? 'assignment' : 'task';

  return (
    <EditorContext.Provider value={value}>
      {children}
      <Modal open={!!state} onClose={close} title={editing ? `Edit ${noun}` : `Add ${noun}`}>
        {state && (
          <TaskForm
            key={editing?.id || 'new'}
            initial={initial}
            lockType={!!state.lockType}
            submitLabel={editing ? 'Save changes' : `Add ${noun}`}
            onSubmit={onSubmit}
            onCancel={close}
          />
        )}
      </Modal>
    </EditorContext.Provider>
  );
}
