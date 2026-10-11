import { cloneElement, useEffect, useId, useRef, useState } from 'react';
import type { ProjectStatus, TaskPriority, TaskStatus } from '../api/types';

export const STATUS_LABEL: Record<ProjectStatus | TaskStatus, string> = {
  Planned: 'Planned',
  Active: 'Active',
  OnHold: 'On hold',
  Completed: 'Completed',
  Todo: 'To do',
  InProgress: 'In progress',
  Blocked: 'Blocked',
  Done: 'Done',
};

export function StatusBadge({ status }: { status: ProjectStatus | TaskStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

export function PriorityMark({ priority }: { priority: TaskPriority }) {
  const level = { Low: 1, Medium: 2, High: 3, Critical: 4 }[priority];
  return (
    <span className={`priority priority-${priority.toLowerCase()}`} title={`${priority} priority`}>
      <span className="priority-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className={i <= level ? 'on' : ''} />
        ))}
      </span>
      {priority}
    </span>
  );
}

export function PageHeader({ title, intro, actions }: { title: string; intro?: string; actions?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {intro && <p className="page-intro">{intro}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="notice notice-error" role="alert">
      <p>{error.message}</p>
      {onRetry && (
        <button className="btn btn-quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Accessible dialog built on the native <dialog> element (focus trap + Esc for free). */
export function Modal({ title, open, onClose, children, footer }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on backdrop
      }}
    >
      {open && (
        <div className="modal-inner">
          <header className="modal-header">
            <h2 id={titleId}>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>
          <div className="modal-body">{children}</div>
          {footer && <footer className="modal-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Field({ label, error, hint, children, wide }: { label: string; error?: string; hint?: string; children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>; wide?: boolean }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className={`field${wide ? ' field-wide' : ''}${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': note ? noteId : undefined, 'aria-invalid': error ? true : undefined })}
      {note && (
        <span id={noteId} className={error ? 'field-error' : 'field-hint'}>
          {note}
        </span>
      )}
    </div>
  );
}

/** Two-step delete: first click asks, second click confirms. */
export function DeleteButton({ onConfirm, label = 'Delete' }: { onConfirm: () => Promise<void> | void; label?: string }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <button type="button" className="btn btn-danger-quiet" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm">
      <span>Delete permanently?</span>
      <button
        type="button"
        className="btn btn-danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setAsking(false);
          }
        }}
      >
        Yes, delete
      </button>
      <button type="button" className="btn btn-quiet" onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  );
}

export function ProgressBar({ done, total, color }: { done: number; total: number; color?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${done} of ${total} tasks done`}>
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
