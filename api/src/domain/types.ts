export const PROJECT_STATUSES = ['Planned', 'Active', 'OnHold', 'Completed'] as const;
export const TASK_STATUSES = ['Todo', 'InProgress', 'Blocked', 'Done'] as const;
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Dates are 'YYYY-MM-DD'; date-times are local wall-clock 'YYYY-MM-DDTHH:mm:ss' (no time zone). */
export interface Worker {
  workerId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  hourlyRate: number | null;
  isActive: boolean;
}

export interface Project {
  projectId: number;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  endDate: string | null;
  budget: number | null;
  color: string;
  /** computed */
  taskCount?: number;
  doneTaskCount?: number;
}

export interface Task {
  taskId: number;
  projectId: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours: number | null;
  dueDate: string | null;
  /** computed */
  projectName?: string;
}

export interface ScheduleEntry {
  scheduleId: number;
  workerId: number;
  projectId: number;
  taskId: number | null;
  startTime: string;
  endTime: string;
  notes: string | null;
  /** computed (joined) */
  workerName?: string;
  projectName?: string;
  projectColor?: string;
  taskTitle?: string | null;
}

export type WorkerInput = Omit<Worker, 'workerId'>;
export type ProjectInput = Omit<Project, 'projectId' | 'taskCount' | 'doneTaskCount'>;
export type TaskInput = Omit<Task, 'taskId' | 'projectName'>;
export type ScheduleInput = Omit<ScheduleEntry, 'scheduleId' | 'workerName' | 'projectName' | 'projectColor' | 'taskTitle'>;

export interface ScheduleQuery {
  from?: string;
  to?: string;
  workerId?: number;
  projectId?: number;
  taskId?: number;
}

export interface TaskQuery {
  projectId?: number;
  status?: TaskStatus;
}

export interface DashboardSummary {
  projects: { total: number; byStatus: Record<ProjectStatus, number> };
  tasks: { total: number; byStatus: Record<TaskStatus, number>; overdue: number };
  workers: { total: number; active: number };
  hoursScheduledThisWeek: number;
}
