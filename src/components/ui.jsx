// Small reusable UI pieces: toasts, confirm dialog, modal, badge, progress bar, empty state...
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const UIContext = createContext(null);
export const useUI = () => useContext(UIContext);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'success') => {
    const id = (idRef.current += 1);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback(
    (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
    [],
  );

  const close = (answer) => {
    dialog?.resolve(answer);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const icons = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <UIContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={18} aria-hidden="true" />
              <span>{t.message}</span>
              <button className="icon-btn sm" aria-label="Dismiss notification" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <Modal open={!!dialog} onClose={() => close(false)} title={dialog?.title || 'Are you sure?'} small>
        <p className="muted">{dialog?.message}</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={() => close(false)}>
            Cancel
          </button>
          <button className={`btn ${dialog?.danger ? 'danger' : 'primary'}`} onClick={() => close(true)} autoFocus>
            {dialog?.confirmLabel || 'Confirm'}
          </button>
        </div>
      </Modal>
    </UIContext.Provider>
  );
}

export function Modal({ open, onClose, title, children, small = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const el = ref.current?.querySelector('[autofocus], input, select, textarea, button.btn');
      el?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${small ? 'small' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ tone = 'slate', icon: Icon, children, title }) {
  return (
    <span className={`badge t-${tone}`} title={title}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function ProgressBar({ value, color, label, height }) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
      style={height ? { height } : undefined}
    >
      <div className="progress-fill" style={{ width: `${v}%`, background: color || undefined }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={26} aria-hidden="true" />
        </div>
      )}
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="field-err" id={`${htmlFor}-err`} role="alert">
          <AlertTriangle size={13} aria-hidden="true" /> {error}
        </p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

export function Avatar({ user, size = 36 }) {
  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();
  const [broken, setBroken] = useState(false);
  if (user?.photo && !broken) {
    return <img className="avatar" src={user.photo} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return (
    <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {initial}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'active' : ''}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
