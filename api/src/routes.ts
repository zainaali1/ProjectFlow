import { Router, type Request } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { requireManager } from './auth.js';
import type { AppConfig } from './config.js';
import type { Repository } from './data/repository.js';
import { badRequest, conflict, notFound } from './errors.js';
import { toDateString, addDays } from './seed/buildDemoData.js';
import { createScheduleEntry, updateScheduleEntry } from './services/scheduleService.js';
import {
  id,
  projectSchema,
  scheduleQuerySchema,
  scheduleSchema,
  taskQuerySchema,
  taskSchema,
  workerSchema,
} from './validation.js';

function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      'Validation failed',
      result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

const idParam = (req: Request) => parse(id, req.params.id);

export function createApiRouter(repo: Repository, config: AppConfig): Router {
  const r = Router();
  const canWrite = requireManager(config);

  // ---------- Current user ----------
  r.get('/me', (req, res) => {
    res.json(req.user);
  });

  // ---------- Dashboard ----------
  r.get('/dashboard', async (_req, res) => {
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    const weekStart = addDays(now, -mondayOffset);
    res.json(
      await repo.dashboard(toDateString(now), `${toDateString(weekStart)}T00:00:00`, `${toDateString(addDays(weekStart, 7))}T00:00:00`),
    );
  });

  // ---------- Workers ----------
  r.get('/workers', async (_req, res) => {
    res.json(await repo.listWorkers());
  });
  r.get('/workers/:id', async (req, res) => {
    const worker = await repo.getWorker(idParam(req));
    if (!worker) throw notFound('Worker');
    res.json(worker);
  });
  r.post('/workers', canWrite, async (req, res) => {
    const input = parse(workerSchema, req.body);
    if (await repo.emailInUse(input.email)) throw conflict('A worker with this email already exists');
    res.status(201).json(await repo.createWorker(input));
  });
  r.put('/workers/:id', canWrite, async (req, res) => {
    const workerId = idParam(req);
    const input = parse(workerSchema, req.body);
    if (await repo.emailInUse(input.email, workerId)) throw conflict('A worker with this email already exists');
    const worker = await repo.updateWorker(workerId, input);
    if (!worker) throw notFound('Worker');
    res.json(worker);
  });
  r.delete('/workers/:id', canWrite, async (req, res) => {
    if (!(await repo.deleteWorker(idParam(req)))) throw notFound('Worker');
    res.status(204).end();
  });

  // ---------- Projects ----------
  r.get('/projects', async (_req, res) => {
    res.json(await repo.listProjects());
  });
  r.get('/projects/:id', async (req, res) => {
    const project = await repo.getProject(idParam(req));
    if (!project) throw notFound('Project');
    res.json(project);
  });
  r.post('/projects', canWrite, async (req, res) => {
    res.status(201).json(await repo.createProject(parse(projectSchema, req.body)));
  });
  r.put('/projects/:id', canWrite, async (req, res) => {
    const project = await repo.updateProject(idParam(req), parse(projectSchema, req.body));
    if (!project) throw notFound('Project');
    res.json(project);
  });
  r.delete('/projects/:id', canWrite, async (req, res) => {
    if (!(await repo.deleteProject(idParam(req)))) throw notFound('Project');
    res.status(204).end();
  });

  // ---------- Tasks ----------
  r.get('/tasks', async (req, res) => {
    res.json(await repo.listTasks(parse(taskQuerySchema, req.query)));
  });
  r.get('/tasks/:id', async (req, res) => {
    const task = await repo.getTask(idParam(req));
    if (!task) throw notFound('Task');
    res.json(task);
  });
  r.post('/tasks', canWrite, async (req, res) => {
    const input = parse(taskSchema, req.body);
    if (!(await repo.getProject(input.projectId))) throw badRequest('Project does not exist');
    res.status(201).json(await repo.createTask(input));
  });
  r.put('/tasks/:id', canWrite, async (req, res) => {
    const input = parse(taskSchema, req.body);
    if (!(await repo.getProject(input.projectId))) throw badRequest('Project does not exist');
    const task = await repo.updateTask(idParam(req), input);
    if (!task) throw notFound('Task');
    res.json(task);
  });
  r.delete('/tasks/:id', canWrite, async (req, res) => {
    if (!(await repo.deleteTask(idParam(req)))) throw notFound('Task');
    res.status(204).end();
  });

  // ---------- Schedule ----------
  r.get('/schedule', async (req, res) => {
    res.json(await repo.listSchedule(parse(scheduleQuerySchema, req.query)));
  });
  r.get('/schedule/:id', async (req, res) => {
    const entry = await repo.getScheduleEntry(idParam(req));
    if (!entry) throw notFound('Schedule entry');
    res.json(entry);
  });
  r.post('/schedule', canWrite, async (req, res) => {
    res.status(201).json(await createScheduleEntry(repo, parse(scheduleSchema, req.body)));
  });
  r.put('/schedule/:id', canWrite, async (req, res) => {
    res.json(await updateScheduleEntry(repo, idParam(req), parse(scheduleSchema, req.body)));
  });
  r.delete('/schedule/:id', canWrite, async (req, res) => {
    if (!(await repo.deleteScheduleEntry(idParam(req)))) throw notFound('Schedule entry');
    res.status(204).end();
  });

  return r;
}
