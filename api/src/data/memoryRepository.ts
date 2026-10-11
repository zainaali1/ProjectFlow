import {
  PROJECT_STATUSES,
  TASK_STATUSES,
  type DashboardSummary,
  type Project,
  type ProjectInput,
  type ScheduleEntry,
  type ScheduleInput,
  type ScheduleQuery,
  type Task,
  type TaskInput,
  type TaskQuery,
  type Worker,
  type WorkerInput,
} from '../domain/types.js';
import { buildDemoData } from '../seed/buildDemoData.js';
import type { Repository } from './repository.js';

const clone = <T>(v: T): T => structuredClone(v);

/**
 * In-memory implementation used by the automated tests and by
 * `DATA_PROVIDER=memory` for trying the app without an Azure database.
 * Data resets every time the process restarts.
 */
export class MemoryRepository implements Repository {
  private workers: Worker[] = [];
  private projects: Project[] = [];
  private tasks: Task[] = [];
  private schedule: ScheduleEntry[] = [];
  private seq = { worker: 0, project: 0, task: 0, schedule: 0 };

  constructor(options: { seed?: boolean; today?: Date } = {}) {
    if (options.seed !== false) {
      const data = buildDemoData(options.today);
      this.workers = data.workers.map((w) => ({ ...w }));
      this.projects = data.projects.map(({ startOffset: _s, endOffset: _e, ...p }) => p);
      this.tasks = data.tasks.map(({ dueOffset: _d, ...t }) => t);
      this.schedule = data.schedule.map(({ dayOffset: _d, startMinutes: _s, endMinutes: _e, ...s }) => s);
      this.seq = {
        worker: this.workers.length,
        project: this.projects.length,
        task: this.tasks.length,
        schedule: this.schedule.length,
      };
    }
  }

  // ---------------- Workers ----------------
  async listWorkers() {
    return clone([...this.workers].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)));
  }
  async getWorker(id: number) {
    const w = this.workers.find((x) => x.workerId === id);
    return w ? clone(w) : null;
  }
  async createWorker(input: WorkerInput) {
    const w: Worker = { ...input, workerId: ++this.seq.worker };
    this.workers.push(w);
    return clone(w);
  }
  async updateWorker(id: number, input: WorkerInput) {
    const i = this.workers.findIndex((x) => x.workerId === id);
    if (i < 0) return null;
    this.workers[i] = { ...input, workerId: id };
    return clone(this.workers[i]!);
  }
  async deleteWorker(id: number) {
    const before = this.workers.length;
    this.workers = this.workers.filter((x) => x.workerId !== id);
    this.schedule = this.schedule.filter((s) => s.workerId !== id);
    return this.workers.length < before;
  }
  async emailInUse(email: string, exceptWorkerId?: number) {
    return this.workers.some((w) => w.email.toLowerCase() === email.toLowerCase() && w.workerId !== exceptWorkerId);
  }

  // ---------------- Projects ----------------
  private withCounts(p: Project): Project {
    const tasks = this.tasks.filter((t) => t.projectId === p.projectId);
    return { ...clone(p), taskCount: tasks.length, doneTaskCount: tasks.filter((t) => t.status === 'Done').length };
  }
  async listProjects() {
    return [...this.projects].sort((a, b) => a.name.localeCompare(b.name)).map((p) => this.withCounts(p));
  }
  async getProject(id: number) {
    const p = this.projects.find((x) => x.projectId === id);
    return p ? this.withCounts(p) : null;
  }
  async createProject(input: ProjectInput) {
    const p: Project = { ...input, projectId: ++this.seq.project };
    this.projects.push(p);
    return this.withCounts(p);
  }
  async updateProject(id: number, input: ProjectInput) {
    const i = this.projects.findIndex((x) => x.projectId === id);
    if (i < 0) return null;
    this.projects[i] = { ...input, projectId: id };
    return this.withCounts(this.projects[i]!);
  }
  async deleteProject(id: number) {
    const before = this.projects.length;
    this.projects = this.projects.filter((x) => x.projectId !== id);
    this.tasks = this.tasks.filter((t) => t.projectId !== id);
    this.schedule = this.schedule.filter((s) => s.projectId !== id);
    return this.projects.length < before;
  }

  // ---------------- Tasks ----------------
  private withProject(t: Task): Task {
    return { ...clone(t), projectName: this.projects.find((p) => p.projectId === t.projectId)?.name };
  }
  async listTasks(query: TaskQuery) {
    return this.tasks
      .filter((t) => (query.projectId === undefined || t.projectId === query.projectId) && (query.status === undefined || t.status === query.status))
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title))
      .map((t) => this.withProject(t));
  }
  async getTask(id: number) {
    const t = this.tasks.find((x) => x.taskId === id);
    return t ? this.withProject(t) : null;
  }
  async createTask(input: TaskInput) {
    const t: Task = { ...input, taskId: ++this.seq.task };
    this.tasks.push(t);
    return this.withProject(t);
  }
  async updateTask(id: number, input: TaskInput) {
    const i = this.tasks.findIndex((x) => x.taskId === id);
    if (i < 0) return null;
    this.tasks[i] = { ...input, taskId: id };
    // keep schedule rows consistent if the task moved to another project
    this.schedule.forEach((s) => {
      if (s.taskId === id) s.projectId = input.projectId;
    });
    return this.withProject(this.tasks[i]!);
  }
  async deleteTask(id: number) {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((x) => x.taskId !== id);
    this.schedule = this.schedule.filter((s) => s.taskId !== id);
    return this.tasks.length < before;
  }

  // ---------------- Schedule ----------------
  private joined(s: ScheduleEntry): ScheduleEntry {
    const w = this.workers.find((x) => x.workerId === s.workerId);
    const p = this.projects.find((x) => x.projectId === s.projectId);
    const t = s.taskId === null ? undefined : this.tasks.find((x) => x.taskId === s.taskId);
    return {
      ...clone(s),
      workerName: w ? `${w.firstName} ${w.lastName}` : undefined,
      projectName: p?.name,
      projectColor: p?.color,
      taskTitle: t?.title ?? null,
    };
  }
  async listSchedule(q: ScheduleQuery) {
    return this.schedule
      .filter(
        (s) =>
          (q.from === undefined || s.endTime > q.from) &&
          (q.to === undefined || s.startTime < q.to) &&
          (q.workerId === undefined || s.workerId === q.workerId) &&
          (q.projectId === undefined || s.projectId === q.projectId) &&
          (q.taskId === undefined || s.taskId === q.taskId),
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.workerId - b.workerId)
      .map((s) => this.joined(s));
  }
  async getScheduleEntry(id: number) {
    const s = this.schedule.find((x) => x.scheduleId === id);
    return s ? this.joined(s) : null;
  }
  async createScheduleEntry(input: ScheduleInput) {
    const s: ScheduleEntry = { ...input, scheduleId: ++this.seq.schedule };
    this.schedule.push(s);
    return this.joined(s);
  }
  async updateScheduleEntry(id: number, input: ScheduleInput) {
    const i = this.schedule.findIndex((x) => x.scheduleId === id);
    if (i < 0) return null;
    this.schedule[i] = { ...input, scheduleId: id };
    return this.joined(this.schedule[i]!);
  }
  async deleteScheduleEntry(id: number) {
    const before = this.schedule.length;
    this.schedule = this.schedule.filter((x) => x.scheduleId !== id);
    return this.schedule.length < before;
  }
  async findOverlaps(workerId: number, start: string, end: string, excludeScheduleId?: number) {
    return this.schedule
      .filter((s) => s.workerId === workerId && s.scheduleId !== excludeScheduleId && s.startTime < end && s.endTime > start)
      .map((s) => this.joined(s));
  }

  // ---------------- Reporting ----------------
  async dashboard(today: string, weekStart: string, weekEnd: string): Promise<DashboardSummary> {
    const projectsByStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0])) as DashboardSummary['projects']['byStatus'];
    this.projects.forEach((p) => projectsByStatus[p.status]++);
    const tasksByStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as DashboardSummary['tasks']['byStatus'];
    this.tasks.forEach((t) => tasksByStatus[t.status]++);
    const hours = this.schedule
      .filter((s) => s.startTime >= weekStart && s.startTime < weekEnd)
      .reduce((sum, s) => sum + (Date.parse(s.endTime) - Date.parse(s.startTime)) / 3_600_000, 0);
    return {
      projects: { total: this.projects.length, byStatus: projectsByStatus },
      tasks: {
        total: this.tasks.length,
        byStatus: tasksByStatus,
        overdue: this.tasks.filter((t) => t.status !== 'Done' && t.dueDate !== null && t.dueDate < today).length,
      },
      workers: { total: this.workers.length, active: this.workers.filter((w) => w.isActive).length },
      hoursScheduledThisWeek: Math.round(hours * 10) / 10,
    };
  }

  async healthCheck() {}
  async close() {}
}
