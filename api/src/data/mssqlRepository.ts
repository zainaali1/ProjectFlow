import sql from 'mssql';
import type { AppConfig } from '../config.js';
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
import type { Repository } from './repository.js';

/**
 * Builds the connection settings for Azure SQL.
 *  - aad-default: passwordless Microsoft Entra auth. Locally it uses your `az login`
 *    (or VS Code) identity; in App Service it uses the app's managed identity.
 *  - sql: classic SQL username/password (only if you cannot use Entra).
 */
export function buildSqlConfig(cfg: AppConfig['sql']): sql.config {
  const base: sql.config = {
    server: cfg.server,
    database: cfg.database,
    port: 1433,
    options: { encrypt: true, trustServerCertificate: false },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 30_000,
    requestTimeout: 30_000,
  };
  if (cfg.auth === 'sql') {
    return { ...base, user: cfg.user, password: cfg.password };
  }
  return {
    ...base,
    authentication: {
      type: 'azure-active-directory-default',
      options: cfg.managedIdentityClientId ? { clientId: cfg.managedIdentityClientId } : {},
    },
  } as sql.config;
}

export async function createPool(cfg: AppConfig['sql']): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool(buildSqlConfig(cfg));
  await pool.connect();
  return pool;
}

// Dates travel as plain strings so no time-zone conversion ever happens:
// DATE -> 'YYYY-MM-DD' (style 23), DATETIME2 -> 'YYYY-MM-DDTHH:mm:ss' (style 126).
const D = (col: string, alias: string) => `CONVERT(char(10), ${col}, 23) AS ${alias}`;
const DT = (col: string, alias: string) => `CONVERT(char(19), ${col}, 126) AS ${alias}`;

const WORKER_COLS = `w.WorkerId AS workerId, w.FirstName AS firstName, w.LastName AS lastName, w.Email AS email,
  w.Role AS role, CAST(w.HourlyRate AS float) AS hourlyRate, w.IsActive AS isActive`;

const PROJECT_COLS = `p.ProjectId AS projectId, p.Name AS name, p.Description AS description, p.Status AS status,
  ${D('p.StartDate', 'startDate')}, ${D('p.EndDate', 'endDate')}, CAST(p.Budget AS float) AS budget, p.Color AS color,
  (SELECT COUNT(*) FROM dbo.Tasks t WHERE t.ProjectId = p.ProjectId) AS taskCount,
  (SELECT COUNT(*) FROM dbo.Tasks t WHERE t.ProjectId = p.ProjectId AND t.Status = N'Done') AS doneTaskCount`;

const TASK_COLS = `t.TaskId AS taskId, t.ProjectId AS projectId, t.Title AS title, t.Description AS description,
  t.Status AS status, t.Priority AS priority, CAST(t.EstimatedHours AS float) AS estimatedHours,
  ${D('t.DueDate', 'dueDate')}, p.Name AS projectName`;

const SCHEDULE_SELECT = `SELECT s.ScheduleId AS scheduleId, s.WorkerId AS workerId, s.ProjectId AS projectId, s.TaskId AS taskId,
  ${DT('s.StartTime', 'startTime')}, ${DT('s.EndTime', 'endTime')}, s.Notes AS notes,
  CONCAT(w.FirstName, N' ', w.LastName) AS workerName, p.Name AS projectName, p.Color AS projectColor, t.Title AS taskTitle
FROM dbo.ScheduleEntries s
JOIN dbo.Workers w ON w.WorkerId = s.WorkerId
JOIN dbo.Projects p ON p.ProjectId = s.ProjectId
LEFT JOIN dbo.Tasks t ON t.TaskId = s.TaskId`;

export class MssqlRepository implements Repository {
  constructor(private readonly pool: sql.ConnectionPool) {}

  private req(tx?: sql.Transaction) {
    return tx ? new sql.Request(tx) : this.pool.request();
  }

  /** Runs work inside a transaction, rolling back on any error. */
  private async inTransaction<T>(work: (tx: sql.Transaction) => Promise<T>): Promise<T> {
    const tx = new sql.Transaction(this.pool);
    await tx.begin();
    try {
      const result = await work(tx);
      await tx.commit();
      return result;
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  // ---------------- Workers ----------------
  async listWorkers(): Promise<Worker[]> {
    const r = await this.req().query<Worker>(`SELECT ${WORKER_COLS} FROM dbo.Workers w ORDER BY w.LastName, w.FirstName`);
    return r.recordset;
  }

  async getWorker(id: number): Promise<Worker | null> {
    const r = await this.req().input('id', sql.Int, id).query<Worker>(`SELECT ${WORKER_COLS} FROM dbo.Workers w WHERE w.WorkerId = @id`);
    return r.recordset[0] ?? null;
  }

  private workerInputs(request: sql.Request, w: WorkerInput) {
    return request
      .input('firstName', sql.NVarChar(100), w.firstName)
      .input('lastName', sql.NVarChar(100), w.lastName)
      .input('email', sql.NVarChar(255), w.email)
      .input('role', sql.NVarChar(100), w.role)
      .input('hourlyRate', sql.Decimal(10, 2), w.hourlyRate)
      .input('isActive', sql.Bit, w.isActive);
  }

  async createWorker(input: WorkerInput): Promise<Worker> {
    const r = await this.workerInputs(this.req(), input).query<{ id: number }>(
      `INSERT INTO dbo.Workers (FirstName, LastName, Email, Role, HourlyRate, IsActive)
       OUTPUT INSERTED.WorkerId AS id
       VALUES (@firstName, @lastName, @email, @role, @hourlyRate, @isActive)`,
    );
    return (await this.getWorker(r.recordset[0]!.id))!;
  }

  async updateWorker(id: number, input: WorkerInput): Promise<Worker | null> {
    const r = await this.workerInputs(this.req().input('id', sql.Int, id), input).query(
      `UPDATE dbo.Workers SET FirstName=@firstName, LastName=@lastName, Email=@email, Role=@role,
         HourlyRate=@hourlyRate, IsActive=@isActive, UpdatedAt=SYSUTCDATETIME()
       WHERE WorkerId=@id`,
    );
    return r.rowsAffected[0] ? this.getWorker(id) : null;
  }

  async deleteWorker(id: number): Promise<boolean> {
    return this.inTransaction(async (tx) => {
      await this.req(tx).input('id', sql.Int, id).query(`DELETE FROM dbo.ScheduleEntries WHERE WorkerId=@id`);
      const r = await this.req(tx).input('id', sql.Int, id).query(`DELETE FROM dbo.Workers WHERE WorkerId=@id`);
      return (r.rowsAffected[0] ?? 0) > 0;
    });
  }

  async emailInUse(email: string, exceptWorkerId?: number): Promise<boolean> {
    const r = await this.req()
      .input('email', sql.NVarChar(255), email)
      .input('except', sql.Int, exceptWorkerId ?? null)
      .query(`SELECT 1 AS x FROM dbo.Workers WHERE Email=@email AND (@except IS NULL OR WorkerId <> @except)`);
    return r.recordset.length > 0;
  }

  // ---------------- Projects ----------------
  async listProjects(): Promise<Project[]> {
    const r = await this.req().query<Project>(`SELECT ${PROJECT_COLS} FROM dbo.Projects p ORDER BY p.Name`);
    return r.recordset;
  }

  async getProject(id: number): Promise<Project | null> {
    const r = await this.req().input('id', sql.Int, id).query<Project>(`SELECT ${PROJECT_COLS} FROM dbo.Projects p WHERE p.ProjectId=@id`);
    return r.recordset[0] ?? null;
  }

  private projectInputs(request: sql.Request, p: ProjectInput) {
    return request
      .input('name', sql.NVarChar(200), p.name)
      .input('description', sql.NVarChar(2000), p.description)
      .input('status', sql.NVarChar(20), p.status)
      .input('startDate', sql.VarChar(10), p.startDate)
      .input('endDate', sql.VarChar(10), p.endDate)
      .input('budget', sql.Decimal(12, 2), p.budget)
      .input('color', sql.Char(7), p.color);
  }

  async createProject(input: ProjectInput): Promise<Project> {
    const r = await this.projectInputs(this.req(), input).query<{ id: number }>(
      `INSERT INTO dbo.Projects (Name, Description, Status, StartDate, EndDate, Budget, Color)
       OUTPUT INSERTED.ProjectId AS id
       VALUES (@name, @description, @status, CONVERT(date, @startDate, 23), CONVERT(date, @endDate, 23), @budget, @color)`,
    );
    return (await this.getProject(r.recordset[0]!.id))!;
  }

  async updateProject(id: number, input: ProjectInput): Promise<Project | null> {
    const r = await this.projectInputs(this.req().input('id', sql.Int, id), input).query(
      `UPDATE dbo.Projects SET Name=@name, Description=@description, Status=@status,
         StartDate=CONVERT(date, @startDate, 23), EndDate=CONVERT(date, @endDate, 23),
         Budget=@budget, Color=@color, UpdatedAt=SYSUTCDATETIME()
       WHERE ProjectId=@id`,
    );
    return r.rowsAffected[0] ? this.getProject(id) : null;
  }

  async deleteProject(id: number): Promise<boolean> {
    return this.inTransaction(async (tx) => {
      await this.req(tx).input('id', sql.Int, id).query(`DELETE FROM dbo.ScheduleEntries WHERE ProjectId=@id`);
      // Tasks are removed by ON DELETE CASCADE
      const r = await this.req(tx).input('id', sql.Int, id).query(`DELETE FROM dbo.Projects WHERE ProjectId=@id`);
      return (r.rowsAffected[0] ?? 0) > 0;
    });
  }

  // ---------------- Tasks ----------------
  async listTasks(q: TaskQuery): Promise<Task[]> {
    const r = await this.req()
      .input('projectId', sql.Int, q.projectId ?? null)
      .input('status', sql.NVarChar(20), q.status ?? null)
      .query<Task>(
        `SELECT ${TASK_COLS} FROM dbo.Tasks t JOIN dbo.Projects p ON p.ProjectId = t.ProjectId
         WHERE (@projectId IS NULL OR t.ProjectId=@projectId) AND (@status IS NULL OR t.Status=@status)
         ORDER BY CASE WHEN t.DueDate IS NULL THEN 1 ELSE 0 END, t.DueDate, t.Title`,
      );
    return r.recordset;
  }

  async getTask(id: number): Promise<Task | null> {
    const r = await this.req()
      .input('id', sql.Int, id)
      .query<Task>(`SELECT ${TASK_COLS} FROM dbo.Tasks t JOIN dbo.Projects p ON p.ProjectId = t.ProjectId WHERE t.TaskId=@id`);
    return r.recordset[0] ?? null;
  }

  private taskInputs(request: sql.Request, t: TaskInput) {
    return request
      .input('projectId', sql.Int, t.projectId)
      .input('title', sql.NVarChar(200), t.title)
      .input('description', sql.NVarChar(2000), t.description)
      .input('status', sql.NVarChar(20), t.status)
      .input('priority', sql.NVarChar(20), t.priority)
      .input('estimatedHours', sql.Decimal(6, 2), t.estimatedHours)
      .input('dueDate', sql.VarChar(10), t.dueDate);
  }

  async createTask(input: TaskInput): Promise<Task> {
    const r = await this.taskInputs(this.req(), input).query<{ id: number }>(
      `INSERT INTO dbo.Tasks (ProjectId, Title, Description, Status, Priority, EstimatedHours, DueDate)
       OUTPUT INSERTED.TaskId AS id
       VALUES (@projectId, @title, @description, @status, @priority, @estimatedHours, CONVERT(date, @dueDate, 23))`,
    );
    return (await this.getTask(r.recordset[0]!.id))!;
  }

  async updateTask(id: number, input: TaskInput): Promise<Task | null> {
    const updated = await this.inTransaction(async (tx) => {
      const r = await this.taskInputs(this.req(tx).input('id', sql.Int, id), input).query(
        `UPDATE dbo.Tasks SET ProjectId=@projectId, Title=@title, Description=@description, Status=@status,
           Priority=@priority, EstimatedHours=@estimatedHours, DueDate=CONVERT(date, @dueDate, 23), UpdatedAt=SYSUTCDATETIME()
         WHERE TaskId=@id`,
      );
      // keep schedule rows consistent if the task moved to another project
      await this.req(tx)
        .input('id', sql.Int, id)
        .input('projectId', sql.Int, input.projectId)
        .query(`UPDATE dbo.ScheduleEntries SET ProjectId=@projectId WHERE TaskId=@id AND ProjectId<>@projectId`);
      return (r.rowsAffected[0] ?? 0) > 0;
    });
    return updated ? this.getTask(id) : null;
  }

  async deleteTask(id: number): Promise<boolean> {
    return this.inTransaction(async (tx) => {
      await this.req(tx).input('id', sql.Int, id).query(`DELETE FROM dbo.ScheduleEntries WHERE TaskId=@id`);
      const r = await this.req(tx).input('id', sql.Int, id).query(`DELETE FROM dbo.Tasks WHERE TaskId=@id`);
      return (r.rowsAffected[0] ?? 0) > 0;
    });
  }

  // ---------------- Schedule ----------------
  async listSchedule(q: ScheduleQuery): Promise<ScheduleEntry[]> {
    const r = await this.req()
      .input('from', sql.VarChar(19), q.from ?? null)
      .input('to', sql.VarChar(19), q.to ?? null)
      .input('workerId', sql.Int, q.workerId ?? null)
      .input('projectId', sql.Int, q.projectId ?? null)
      .input('taskId', sql.Int, q.taskId ?? null)
      .query<ScheduleEntry>(
        `${SCHEDULE_SELECT}
         WHERE (@from IS NULL OR s.EndTime > CONVERT(datetime2(0), @from, 126))
           AND (@to IS NULL OR s.StartTime < CONVERT(datetime2(0), @to, 126))
           AND (@workerId IS NULL OR s.WorkerId=@workerId)
           AND (@projectId IS NULL OR s.ProjectId=@projectId)
           AND (@taskId IS NULL OR s.TaskId=@taskId)
         ORDER BY s.StartTime, s.WorkerId`,
      );
    return r.recordset;
  }

  async getScheduleEntry(id: number): Promise<ScheduleEntry | null> {
    const r = await this.req().input('id', sql.Int, id).query<ScheduleEntry>(`${SCHEDULE_SELECT} WHERE s.ScheduleId=@id`);
    return r.recordset[0] ?? null;
  }

  private scheduleInputs(request: sql.Request, s: ScheduleInput) {
    return request
      .input('workerId', sql.Int, s.workerId)
      .input('projectId', sql.Int, s.projectId)
      .input('taskId', sql.Int, s.taskId)
      .input('startTime', sql.VarChar(19), s.startTime)
      .input('endTime', sql.VarChar(19), s.endTime)
      .input('notes', sql.NVarChar(1000), s.notes);
  }

  async createScheduleEntry(input: ScheduleInput): Promise<ScheduleEntry> {
    const r = await this.scheduleInputs(this.req(), input).query<{ id: number }>(
      `INSERT INTO dbo.ScheduleEntries (WorkerId, ProjectId, TaskId, StartTime, EndTime, Notes)
       OUTPUT INSERTED.ScheduleId AS id
       VALUES (@workerId, @projectId, @taskId, CONVERT(datetime2(0), @startTime, 126), CONVERT(datetime2(0), @endTime, 126), @notes)`,
    );
    return (await this.getScheduleEntry(r.recordset[0]!.id))!;
  }

  async updateScheduleEntry(id: number, input: ScheduleInput): Promise<ScheduleEntry | null> {
    const r = await this.scheduleInputs(this.req().input('id', sql.Int, id), input).query(
      `UPDATE dbo.ScheduleEntries SET WorkerId=@workerId, ProjectId=@projectId, TaskId=@taskId,
         StartTime=CONVERT(datetime2(0), @startTime, 126), EndTime=CONVERT(datetime2(0), @endTime, 126),
         Notes=@notes, UpdatedAt=SYSUTCDATETIME()
       WHERE ScheduleId=@id`,
    );
    return r.rowsAffected[0] ? this.getScheduleEntry(id) : null;
  }

  async deleteScheduleEntry(id: number): Promise<boolean> {
    const r = await this.req().input('id', sql.Int, id).query(`DELETE FROM dbo.ScheduleEntries WHERE ScheduleId=@id`);
    return (r.rowsAffected[0] ?? 0) > 0;
  }

  async findOverlaps(workerId: number, start: string, end: string, excludeScheduleId?: number): Promise<ScheduleEntry[]> {
    const r = await this.req()
      .input('workerId', sql.Int, workerId)
      .input('start', sql.VarChar(19), start)
      .input('end', sql.VarChar(19), end)
      .input('exclude', sql.Int, excludeScheduleId ?? null)
      .query<ScheduleEntry>(
        `${SCHEDULE_SELECT}
         WHERE s.WorkerId=@workerId
           AND s.StartTime < CONVERT(datetime2(0), @end, 126)
           AND s.EndTime > CONVERT(datetime2(0), @start, 126)
           AND (@exclude IS NULL OR s.ScheduleId <> @exclude)`,
      );
    return r.recordset;
  }

  // ---------------- Reporting ----------------
  async dashboard(today: string, weekStart: string, weekEnd: string): Promise<DashboardSummary> {
    const r = await this.req()
      .input('today', sql.VarChar(10), today)
      .input('weekStart', sql.VarChar(19), weekStart)
      .input('weekEnd', sql.VarChar(19), weekEnd)
      .query(
        `SELECT Status AS status, COUNT(*) AS n FROM dbo.Projects GROUP BY Status;
         SELECT Status AS status, COUNT(*) AS n FROM dbo.Tasks GROUP BY Status;
         SELECT COUNT(*) AS overdue FROM dbo.Tasks WHERE Status <> N'Done' AND DueDate < CONVERT(date, @today, 23);
         SELECT COUNT(*) AS total, SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) AS active FROM dbo.Workers;
         SELECT CAST(ISNULL(SUM(DATEDIFF(minute, StartTime, EndTime)), 0) / 60.0 AS float) AS hours
           FROM dbo.ScheduleEntries
           WHERE StartTime >= CONVERT(datetime2(0), @weekStart, 126) AND StartTime < CONVERT(datetime2(0), @weekEnd, 126);`,
      );
    const sets = r.recordsets as unknown as Record<string, number | string>[][];
    const projectsByStatus = Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0])) as DashboardSummary['projects']['byStatus'];
    sets[0]!.forEach((row) => (projectsByStatus[row.status as Project['status']] = Number(row.n)));
    const tasksByStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as DashboardSummary['tasks']['byStatus'];
    sets[1]!.forEach((row) => (tasksByStatus[row.status as Task['status']] = Number(row.n)));
    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    const workerRow = sets[3]![0]!;
    return {
      projects: { total: sum(projectsByStatus), byStatus: projectsByStatus },
      tasks: { total: sum(tasksByStatus), byStatus: tasksByStatus, overdue: Number(sets[2]![0]!.overdue) },
      workers: { total: Number(workerRow.total), active: Number(workerRow.active ?? 0) },
      hoursScheduledThisWeek: Math.round(Number(sets[4]![0]!.hours) * 10) / 10,
    };
  }

  async healthCheck() {
    await this.req().query('SELECT 1 AS ok');
  }

  async close() {
    await this.pool.close();
  }
}
