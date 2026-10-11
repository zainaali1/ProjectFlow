import type { Project, ScheduleEntry, Task, Worker } from '../domain/types.js';
import { demoProjects, demoTasks, demoWorkers } from './demoData.js';

/** A schedule row expressed relative to "today", so it can also be written as SQL. */
export interface RelativeSchedule {
  dayOffset: number;
  startMinutes: number;
  endMinutes: number;
}

export interface DemoDataset {
  workers: Worker[];
  projects: (Project & { startOffset: number; endOffset: number })[];
  tasks: (Task & { dueOffset: number })[];
  schedule: (ScheduleEntry & RelativeSchedule)[];
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function dateTime(base: Date, dayOffset: number, minutes: number): string {
  const d = addDays(base, dayOffset);
  return `${toDateString(d)}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00`;
}

/** Working blocks a person can be booked into (minutes from midnight). */
const SLOTS: [number, number][] = [
  [9 * 60, 12 * 60],
  [13 * 60, 17 * 60],
];

/**
 * Turns the AI-written demo content into concrete rows with ids and dates,
 * and generates a realistic, clash-free schedule: every assignee gets
 * 3-4 hour working blocks on weekdays leading up to each task's due date.
 */
export function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

export function buildDemoData(now: Date = new Date()): DemoDataset {
  // All offsets are counted from the Monday of the current week so that
  // weekdays stay weekdays no matter which day the data is seeded on.
  const today = mondayOf(now);
  const workers: Worker[] = demoWorkers.map((w, i) => ({
    workerId: i + 1,
    firstName: w.firstName,
    lastName: w.lastName,
    email: w.email,
    role: w.role,
    hourlyRate: w.hourlyRate,
    isActive: true,
  }));
  const workerByEmail = new Map(workers.map((w) => [w.email, w]));

  const projects = demoProjects.map((p, i) => ({
    projectId: i + 1,
    name: p.name,
    description: p.description,
    status: p.status,
    startDate: toDateString(addDays(today, p.startOffset)),
    endDate: toDateString(addDays(today, p.endOffset)),
    budget: p.budget,
    color: p.color,
    startOffset: p.startOffset,
    endOffset: p.endOffset,
  }));
  const projectByKey = new Map(demoProjects.map((p, i) => [p.key, projects[i]!]));

  const tasks = demoTasks.map((t, i) => {
    const project = projectByKey.get(t.project);
    if (!project) throw new Error(`Unknown project key ${t.project}`);
    return {
      taskId: i + 1,
      projectId: project.projectId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      estimatedHours: t.estimatedHours,
      dueDate: toDateString(addDays(today, t.dueOffset)),
      dueOffset: t.dueOffset,
    };
  });

  // ---- schedule generation ----
  const busy = new Set<string>(); // `${workerId}|${dayOffset}|${slotIndex}`
  const schedule: DemoDataset['schedule'] = [];

  const isWeekend = (offset: number) => {
    const day = addDays(today, offset).getDay();
    return day === 0 || day === 6;
  };

  demoTasks.forEach((t, i) => {
    const task = tasks[i]!;
    const project = projectByKey.get(t.project)!;
    // Spread the estimate across assignees, in blocks of ~3.5h, max 4 blocks each.
    const blocksPerPerson = Math.min(4, Math.max(1, Math.round(t.estimatedHours / t.assignees.length / 3.5 / 2)));

    t.assignees.forEach((email, personIndex) => {
      const worker = workerByEmail.get(email);
      if (!worker) throw new Error(`Unknown worker ${email}`);
      let placed = 0;
      // walk backwards from the day before the due date
      for (let offset = t.dueOffset - 1 - personIndex; offset >= project.startOffset && placed < blocksPerPerson; offset--) {
        if (isWeekend(offset)) continue;
        for (let s = 0; s < SLOTS.length && placed < blocksPerPerson; s++) {
          const slotIndex = (s + i + personIndex) % SLOTS.length; // vary morning/afternoon
          const key = `${worker.workerId}|${offset}|${slotIndex}`;
          if (busy.has(key)) continue;
          busy.add(key);
          const [startMinutes, endMinutes] = SLOTS[slotIndex]!;
          schedule.push({
            scheduleId: 0,
            workerId: worker.workerId,
            projectId: project.projectId,
            taskId: task.taskId,
            startTime: dateTime(today, offset, startMinutes),
            endTime: dateTime(today, offset, endMinutes),
            notes: null,
            dayOffset: offset,
            startMinutes,
            endMinutes,
          });
          placed++;
          break; // at most one block per person per day for a task
        }
      }
    });
  });

  schedule.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.workerId - b.workerId);
  schedule.forEach((s, i) => (s.scheduleId = i + 1));

  return { workers, projects, tasks, schedule };
}
