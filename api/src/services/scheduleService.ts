import type { Repository } from '../data/repository.js';
import type { ScheduleInput } from '../domain/types.js';
import { badRequest, conflict, notFound } from '../errors.js';

export const MAX_ENTRY_HOURS = 12;

/**
 * Business rules for scheduling a worker:
 *  1. the worker, project and (optional) task must exist
 *  2. the worker must be active
 *  3. the task must belong to the chosen project
 *  4. completed projects cannot receive new or changed bookings
 *  5. one booking is at most 12 hours
 *  6. a worker can never be double-booked (no overlapping entries)
 */
export async function validateScheduleEntry(repo: Repository, input: ScheduleInput, existingId?: number): Promise<void> {
  const [worker, project, task] = await Promise.all([
    repo.getWorker(input.workerId),
    repo.getProject(input.projectId),
    input.taskId === null ? Promise.resolve(null) : repo.getTask(input.taskId),
  ]);

  if (!worker) throw badRequest('Worker does not exist');
  if (!project) throw badRequest('Project does not exist');
  if (input.taskId !== null && !task) throw badRequest('Task does not exist');

  if (!worker.isActive) throw badRequest(`${worker.firstName} ${worker.lastName} is inactive and cannot be scheduled`);
  if (task && task.projectId !== project.projectId) throw badRequest('The task does not belong to the selected project');
  if (project.status === 'Completed') throw badRequest('Cannot schedule work on a completed project');

  const hours = (Date.parse(input.endTime) - Date.parse(input.startTime)) / 3_600_000;
  if (hours > MAX_ENTRY_HOURS) throw badRequest(`A schedule entry can be at most ${MAX_ENTRY_HOURS} hours`);

  const overlaps = await repo.findOverlaps(input.workerId, input.startTime, input.endTime, existingId);
  if (overlaps.length > 0) {
    throw conflict(`${worker.firstName} ${worker.lastName} is already booked at that time`, {
      conflicts: overlaps.map((o) => ({
        scheduleId: o.scheduleId,
        startTime: o.startTime,
        endTime: o.endTime,
        projectName: o.projectName,
        taskTitle: o.taskTitle,
      })),
    });
  }
}

export async function createScheduleEntry(repo: Repository, input: ScheduleInput) {
  await validateScheduleEntry(repo, input);
  return repo.createScheduleEntry(input);
}

export async function updateScheduleEntry(repo: Repository, id: number, input: ScheduleInput) {
  if (!(await repo.getScheduleEntry(id))) throw notFound('Schedule entry');
  await validateScheduleEntry(repo, input, id);
  return (await repo.updateScheduleEntry(id, input))!;
}
