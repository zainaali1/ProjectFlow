import { useState } from 'react';
import { useApi, useLoad } from '../api/ApiContext';
import { ApiError } from '../api/client';
import {
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Project,
  type ProjectInput,
  type ScheduleEntry,
  type Task,
  type TaskInput,
  type Worker,
  type WorkerInput,
} from '../api/types';
import { formatTime } from '../utils/dates';
import { useToast } from './Toast';
import { DeleteButton, Field, Modal, STATUS_LABEL } from './ui';

const PROJECT_COLORS = ['#4F46E5', '#0891B2', '#059669', '#DC2626', '#D97706', '#9333EA', '#DB2777', '#475569'];

/** Shared submit logic: calls the API, maps validation errors onto fields, shows a toast. */
function useSubmit() {
  const toast = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ScheduleEntry[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit(action: () => Promise<unknown>, success: string, onDone: () => void) {
    setBusy(true);
    setErrors({});
    setFormError(null);
    setConflicts([]);
    try {
      await action();
      toast(success);
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors);
        setFormError(err.message === 'Validation failed' ? 'Check the highlighted fields.' : err.message);
        const c = (err.details as { conflicts?: ScheduleEntry[] } | undefined)?.conflicts;
        if (c) setConflicts(c);
      } else {
        setFormError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }
  return { errors, formError, conflicts, busy, submit };
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));
const strOrNull = (v: string) => (v.trim() === '' ? null : v);

interface FormProps<T> {
  open: boolean;
  existing?: T | null;
  onClose: () => void;
  onSaved: () => void;
  /** Called after a delete; defaults to onSaved. */
  onDeleted?: () => void;
}

function Footer({ formId, busy, isEdit, onClose, onDelete, noun }: { formId: string; busy: boolean; isEdit: boolean; onClose: () => void; onDelete?: () => Promise<void>; noun: string }) {
  return (
    <>
      {isEdit && onDelete && <DeleteButton onConfirm={onDelete} label={`Delete ${noun}`} />}
      <span className="spacer" />
      <button type="button" className="btn btn-quiet" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form={formId} className="btn btn-primary" disabled={busy}>
        {busy ? 'Saving…' : isEdit ? 'Save changes' : `Add ${noun}`}
      </button>
    </>
  );
}

// ---------------------------------------------------------------- Project
export function ProjectForm({ open, existing, onClose, onSaved, onDeleted }: FormProps<Project>) {
  const api = useApi();
  const toast = useToast();
  const { errors, formError, busy, submit } = useSubmit();
  const [v, setV] = useState(() => ({
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    status: existing?.status ?? 'Planned',
    startDate: existing?.startDate ?? '',
    endDate: existing?.endDate ?? '',
    budget: existing?.budget?.toString() ?? '',
    color: existing?.color ?? PROJECT_COLORS[0]!,
  }));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const body: ProjectInput = {
    name: v.name,
    description: strOrNull(v.description),
    status: v.status as ProjectInput['status'],
    startDate: strOrNull(v.startDate),
    endDate: strOrNull(v.endDate),
    budget: numOrNull(v.budget),
    color: v.color,
  };

  return (
    <Modal
      title={existing ? 'Edit project' : 'New project'}
      open={open}
      onClose={onClose}
      footer={
        <Footer
          formId="project-form"
          busy={busy}
          isEdit={!!existing}
          onClose={onClose}
          noun="project"
          onDelete={
            existing
              ? async () => {
                  await api.deleteProject(existing.projectId);
                  toast('Project deleted');
                  (onDeleted ?? onSaved)();
                }
              : undefined
          }
        />
      }
    >
      <form
        id="project-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(() => (existing ? api.updateProject(existing.projectId, body) : api.createProject(body)), existing ? 'Project saved' : 'Project added', onSaved);
        }}
      >
        {formError && <p className="form-error field-wide">{formError}</p>}
        <Field label="Name" error={errors.name} wide>
          <input value={v.name} onChange={set('name')} required maxLength={200} autoFocus />
        </Field>
        <Field label="Description" error={errors.description} wide>
          <textarea value={v.description} onChange={set('description')} rows={3} maxLength={2000} />
        </Field>
        <Field label="Status" error={errors.status}>
          <select value={v.status} onChange={set('status')}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Budget (USD)" error={errors.budget}>
          <input type="number" min={0} step={100} inputMode="decimal" value={v.budget} onChange={set('budget')} />
        </Field>
        <Field label="Start date" error={errors.startDate}>
          <input type="date" value={v.startDate} onChange={set('startDate')} />
        </Field>
        <Field label="End date" error={errors.endDate}>
          <input type="date" value={v.endDate} min={v.startDate || undefined} onChange={set('endDate')} />
        </Field>
        <fieldset className="field field-wide swatches">
          <legend className="field-label">Colour on the schedule</legend>
          {PROJECT_COLORS.map((c) => (
            <label key={c} className="swatch" style={{ background: c }}>
              <input type="radio" name="color" value={c} checked={v.color === c} onChange={set('color')} aria-label={c} />
            </label>
          ))}
        </fieldset>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Task
export function TaskForm({ open, existing, onClose, onSaved, onDeleted, defaultProjectId }: FormProps<Task> & { defaultProjectId?: number }) {
  const api = useApi();
  const toast = useToast();
  const projects = useLoad((a) => a.projects());
  const { errors, formError, busy, submit } = useSubmit();
  const [v, setV] = useState(() => ({
    projectId: String(existing?.projectId ?? defaultProjectId ?? ''),
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    status: existing?.status ?? 'Todo',
    priority: existing?.priority ?? 'Medium',
    estimatedHours: existing?.estimatedHours?.toString() ?? '',
    dueDate: existing?.dueDate ?? '',
  }));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const body: TaskInput = {
    projectId: Number(v.projectId),
    title: v.title,
    description: strOrNull(v.description),
    status: v.status as TaskInput['status'],
    priority: v.priority as TaskInput['priority'],
    estimatedHours: numOrNull(v.estimatedHours),
    dueDate: strOrNull(v.dueDate),
  };

  return (
    <Modal
      title={existing ? 'Edit task' : 'New task'}
      open={open}
      onClose={onClose}
      footer={
        <Footer
          formId="task-form"
          busy={busy}
          isEdit={!!existing}
          onClose={onClose}
          noun="task"
          onDelete={
            existing
              ? async () => {
                  await api.deleteTask(existing.taskId);
                  toast('Task deleted');
                  (onDeleted ?? onSaved)();
                }
              : undefined
          }
        />
      }
    >
      <form
        id="task-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(() => (existing ? api.updateTask(existing.taskId, body) : api.createTask(body)), existing ? 'Task saved' : 'Task added', onSaved);
        }}
      >
        {formError && <p className="form-error field-wide">{formError}</p>}
        <Field label="Title" error={errors.title} wide>
          <input value={v.title} onChange={set('title')} required maxLength={200} autoFocus />
        </Field>
        <Field label="Project" error={errors.projectId} wide>
          <select value={v.projectId} onChange={set('projectId')} required>
            <option value="">Choose a project</option>
            {projects.data?.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" error={errors.description} wide>
          <textarea value={v.description} onChange={set('description')} rows={3} maxLength={2000} />
        </Field>
        <Field label="Status" error={errors.status}>
          <select value={v.status} onChange={set('status')}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority" error={errors.priority}>
          <select value={v.priority} onChange={set('priority')}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Estimated hours" error={errors.estimatedHours}>
          <input type="number" min={0} step={0.5} inputMode="decimal" value={v.estimatedHours} onChange={set('estimatedHours')} />
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          <input type="date" value={v.dueDate} onChange={set('dueDate')} />
        </Field>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Worker
export function WorkerForm({ open, existing, onClose, onSaved, onDeleted }: FormProps<Worker>) {
  const api = useApi();
  const toast = useToast();
  const { errors, formError, busy, submit } = useSubmit();
  const [v, setV] = useState(() => ({
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    email: existing?.email ?? '',
    role: existing?.role ?? '',
    hourlyRate: existing?.hourlyRate?.toString() ?? '',
    isActive: existing?.isActive ?? true,
  }));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  const body: WorkerInput = { ...v, hourlyRate: numOrNull(v.hourlyRate) };

  return (
    <Modal
      title={existing ? 'Edit person' : 'Add a person'}
      open={open}
      onClose={onClose}
      footer={
        <Footer
          formId="worker-form"
          busy={busy}
          isEdit={!!existing}
          onClose={onClose}
          noun="person"
          onDelete={
            existing
              ? async () => {
                  await api.deleteWorker(existing.workerId);
                  toast('Person removed');
                  (onDeleted ?? onSaved)();
                }
              : undefined
          }
        />
      }
    >
      <form
        id="worker-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(() => (existing ? api.updateWorker(existing.workerId, body) : api.createWorker(body)), existing ? 'Person saved' : 'Person added', onSaved);
        }}
      >
        {formError && <p className="form-error field-wide">{formError}</p>}
        <Field label="First name" error={errors.firstName}>
          <input value={v.firstName} onChange={set('firstName')} required maxLength={100} autoFocus autoComplete="off" />
        </Field>
        <Field label="Last name" error={errors.lastName}>
          <input value={v.lastName} onChange={set('lastName')} required maxLength={100} autoComplete="off" />
        </Field>
        <Field label="Email" error={errors.email} wide>
          <input type="email" value={v.email} onChange={set('email')} required maxLength={255} autoComplete="off" />
        </Field>
        <Field label="Role" error={errors.role}>
          <input value={v.role} onChange={set('role')} required maxLength={100} placeholder="e.g. Backend Developer" />
        </Field>
        <Field label="Hourly rate (USD)" error={errors.hourlyRate}>
          <input type="number" min={0} step={1} inputMode="decimal" value={v.hourlyRate} onChange={set('hourlyRate')} />
        </Field>
        <label className="check field-wide">
          <input type="checkbox" checked={v.isActive} onChange={(e) => setV({ ...v, isActive: e.target.checked })} />
          Available for scheduling
        </label>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- Schedule entry
export function ScheduleForm({ open, existing, onClose, onSaved, onDeleted, defaultDate, defaultProjectId }: FormProps<ScheduleEntry> & { defaultDate?: string; defaultProjectId?: number }) {
  const api = useApi();
  const toast = useToast();
  const workers = useLoad((a) => a.workers());
  const projects = useLoad((a) => a.projects());
  const { errors, formError, conflicts, busy, submit } = useSubmit();
  const [v, setV] = useState(() => ({
    workerId: String(existing?.workerId ?? ''),
    projectId: String(existing?.projectId ?? defaultProjectId ?? ''),
    taskId: String(existing?.taskId ?? ''),
    date: existing?.startTime.slice(0, 10) ?? defaultDate ?? '',
    start: existing?.startTime.slice(11, 16) ?? '09:00',
    end: existing?.endTime.slice(11, 16) ?? '12:00',
    notes: existing?.notes ?? '',
  }));
  const tasks = useLoad((a) => (v.projectId ? a.tasks({ projectId: Number(v.projectId) }) : Promise.resolve([] as Task[])), [v.projectId]);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV(k === 'projectId' ? { ...v, projectId: e.target.value, taskId: '' } : { ...v, [k]: e.target.value });

  const body = {
    workerId: Number(v.workerId),
    projectId: Number(v.projectId),
    taskId: v.taskId ? Number(v.taskId) : null,
    startTime: `${v.date}T${v.start}`,
    endTime: `${v.date}T${v.end}`,
    notes: strOrNull(v.notes),
  };

  return (
    <Modal
      title={existing ? 'Edit booking' : 'Book time'}
      open={open}
      onClose={onClose}
      footer={
        <Footer
          formId="schedule-form"
          busy={busy}
          isEdit={!!existing}
          onClose={onClose}
          noun="booking"
          onDelete={
            existing
              ? async () => {
                  await api.deleteScheduleEntry(existing.scheduleId);
                  toast('Booking deleted');
                  (onDeleted ?? onSaved)();
                }
              : undefined
          }
        />
      }
    >
      <form
        id="schedule-form"
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(
            () => (existing ? api.updateScheduleEntry(existing.scheduleId, body) : api.createScheduleEntry(body)),
            existing ? 'Booking saved' : 'Time booked',
            onSaved,
          );
        }}
      >
        {formError && (
          <div className="form-error field-wide">
            <p>{formError}</p>
            {conflicts.length > 0 && (
              <ul>
                {conflicts.map((c) => (
                  <li key={c.scheduleId}>
                    {formatTime(c.startTime)}–{formatTime(c.endTime)}: {c.projectName}
                    {c.taskTitle ? `, ${c.taskTitle}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Field label="Who" error={errors.workerId} wide>
          <select value={v.workerId} onChange={set('workerId')} required autoFocus>
            <option value="">Choose a person</option>
            {workers.data
              ?.filter((w) => w.isActive || String(w.workerId) === v.workerId)
              .map((w) => (
                <option key={w.workerId} value={w.workerId}>
                  {w.firstName} {w.lastName} ({w.role})
                </option>
              ))}
          </select>
        </Field>
        <Field label="Project" error={errors.projectId}>
          <select value={v.projectId} onChange={set('projectId')} required>
            <option value="">Choose a project</option>
            {projects.data
              ?.filter((p) => p.status !== 'Completed' || String(p.projectId) === v.projectId)
              .map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Task" error={errors.taskId} hint="Optional">
          <select value={v.taskId} onChange={set('taskId')} disabled={!v.projectId}>
            <option value="">General project work</option>
            {tasks.data?.map((t) => (
              <option key={t.taskId} value={t.taskId}>
                {t.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" error={errors.startTime}>
          <input type="date" value={v.date} onChange={set('date')} required />
        </Field>
        <div className="time-pair">
          <Field label="From">
            <input type="time" value={v.start} onChange={set('start')} required step={900} />
          </Field>
          <Field label="To" error={errors.endTime}>
            <input type="time" value={v.end} onChange={set('end')} required step={900} />
          </Field>
        </div>
        <Field label="Notes" error={errors.notes} wide>
          <textarea value={v.notes} onChange={set('notes')} rows={2} maxLength={1000} />
        </Field>
      </form>
    </Modal>
  );
}
