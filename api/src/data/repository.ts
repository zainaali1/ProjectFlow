import type {
  DashboardSummary,
  Project,
  ProjectInput,
  ScheduleEntry,
  ScheduleInput,
  ScheduleQuery,
  Task,
  TaskInput,
  TaskQuery,
  Worker,
  WorkerInput,
} from '../domain/types.js';

/**
 * The data-access contract. The business logic in /services depends only on
 * this interface, so the same rules run against Azure SQL (MssqlRepository)
 * and against the in-memory demo store used for tests (MemoryRepository).
 */
export interface Repository {
  // Workers
  listWorkers(): Promise<Worker[]>;
  getWorker(id: number): Promise<Worker | null>;
  createWorker(input: WorkerInput): Promise<Worker>;
  updateWorker(id: number, input: WorkerInput): Promise<Worker | null>;
  /** Deletes the worker and their schedule entries. */
  deleteWorker(id: number): Promise<boolean>;
  emailInUse(email: string, exceptWorkerId?: number): Promise<boolean>;

  // Projects
  listProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | null>;
  createProject(input: ProjectInput): Promise<Project>;
  updateProject(id: number, input: ProjectInput): Promise<Project | null>;
  /** Deletes the project, its tasks and all related schedule entries. */
  deleteProject(id: number): Promise<boolean>;

  // Tasks
  listTasks(query: TaskQuery): Promise<Task[]>;
  getTask(id: number): Promise<Task | null>;
  createTask(input: TaskInput): Promise<Task>;
  updateTask(id: number, input: TaskInput): Promise<Task | null>;
  /** Deletes the task and its schedule entries. */
  deleteTask(id: number): Promise<boolean>;

  // Schedule
  listSchedule(query: ScheduleQuery): Promise<ScheduleEntry[]>;
  getScheduleEntry(id: number): Promise<ScheduleEntry | null>;
  createScheduleEntry(input: ScheduleInput): Promise<ScheduleEntry>;
  updateScheduleEntry(id: number, input: ScheduleInput): Promise<ScheduleEntry | null>;
  deleteScheduleEntry(id: number): Promise<boolean>;
  /** Entries for the worker that overlap [start, end), optionally ignoring one entry. */
  findOverlaps(workerId: number, start: string, end: string, excludeScheduleId?: number): Promise<ScheduleEntry[]>;

  // Reporting
  dashboard(today: string, weekStart: string, weekEnd: string): Promise<DashboardSummary>;

  healthCheck(): Promise<void>;
  close(): Promise<void>;
}
