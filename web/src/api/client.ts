import type {
  DashboardSummary,
  Project,
  ProjectInput,
  ScheduleEntry,
  ScheduleInput,
  Task,
  TaskInput,
  Worker,
  WorkerInput,
} from './types';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }

  /** Field-level validation messages, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries((this.details as { field: string; message: string }[]).map((d) => [d.field, d.message]));
  }
}

export type TokenGetter = () => Promise<string | null>;

export function createApi(getToken: TokenGetter) {
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.details);
    }
    return data as T;
  }

  const qs = (params: Record<string, string | number | undefined>) => {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][];
    return entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))}` : '';
  };

  return {
    dashboard: () => call<DashboardSummary>('GET', '/dashboard'),

    workers: () => call<Worker[]>('GET', '/workers'),
    createWorker: (w: WorkerInput) => call<Worker>('POST', '/workers', w),
    updateWorker: (id: number, w: WorkerInput) => call<Worker>('PUT', `/workers/${id}`, w),
    deleteWorker: (id: number) => call<void>('DELETE', `/workers/${id}`),

    projects: () => call<Project[]>('GET', '/projects'),
    project: (id: number) => call<Project>('GET', `/projects/${id}`),
    createProject: (p: ProjectInput) => call<Project>('POST', '/projects', p),
    updateProject: (id: number, p: ProjectInput) => call<Project>('PUT', `/projects/${id}`, p),
    deleteProject: (id: number) => call<void>('DELETE', `/projects/${id}`),

    tasks: (q: { projectId?: number; status?: string } = {}) => call<Task[]>('GET', `/tasks${qs(q)}`),
    createTask: (t: TaskInput) => call<Task>('POST', '/tasks', t),
    updateTask: (id: number, t: TaskInput) => call<Task>('PUT', `/tasks/${id}`, t),
    deleteTask: (id: number) => call<void>('DELETE', `/tasks/${id}`),

    schedule: (q: { from?: string; to?: string; workerId?: number; projectId?: number; taskId?: number } = {}) =>
      call<ScheduleEntry[]>('GET', `/schedule${qs(q)}`),
    createScheduleEntry: (s: ScheduleInput) => call<ScheduleEntry>('POST', '/schedule', s),
    updateScheduleEntry: (id: number, s: ScheduleInput) => call<ScheduleEntry>('PUT', `/schedule/${id}`, s),
    deleteScheduleEntry: (id: number) => call<void>('DELETE', `/schedule/${id}`),
  };
}

export type Api = ReturnType<typeof createApi>;
