import { z } from 'zod';
import { PROJECT_STATUSES, TASK_PRIORITIES, TASK_STATUSES } from './domain/types.js';

/** Every request body and query string is validated here before it reaches business logic or SQL. */

const isRealDate = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d;
};

export const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(isRealDate, 'Not a real date');

export const dateTimeString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Use YYYY-MM-DDTHH:mm')
  .refine(isRealDate, 'Not a real date')
  .transform((s) => (s.length === 16 ? `${s}:00` : s));

const trimmed = (max: number) => z.string().trim().min(1, 'Required').max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const id = z.coerce.number().int().positive();

export const workerSchema = z.object({
  firstName: trimmed(100),
  lastName: trimmed(100),
  email: z.string().trim().toLowerCase().email().max(255),
  role: trimmed(100),
  hourlyRate: z.number().min(0).max(100000).nullish().transform((v) => v ?? null),
  isActive: z.boolean().default(true),
});

export const projectSchema = z
  .object({
    name: trimmed(200),
    description: optionalText(2000),
    status: z.enum(PROJECT_STATUSES).default('Planned'),
    startDate: dateString.nullish().transform((v) => v ?? null),
    endDate: dateString.nullish().transform((v) => v ?? null),
    budget: z.number().min(0).max(1e10).nullish().transform((v) => v ?? null),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #4F46E5')
      .default('#4F46E5'),
  })
  .refine((p) => !p.startDate || !p.endDate || p.endDate >= p.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  });

export const taskSchema = z.object({
  projectId: id,
  title: trimmed(200),
  description: optionalText(2000),
  status: z.enum(TASK_STATUSES).default('Todo'),
  priority: z.enum(TASK_PRIORITIES).default('Medium'),
  estimatedHours: z.number().min(0).max(10000).nullish().transform((v) => v ?? null),
  dueDate: dateString.nullish().transform((v) => v ?? null),
});

export const scheduleSchema = z
  .object({
    workerId: id,
    projectId: id,
    taskId: id.nullish().transform((v) => v ?? null),
    startTime: dateTimeString,
    endTime: dateTimeString,
    notes: optionalText(1000),
  })
  .refine((s) => s.endTime > s.startTime, { message: 'End time must be after start time', path: ['endTime'] });

export const taskQuerySchema = z.object({
  projectId: id.optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export const scheduleQuerySchema = z.object({
  from: dateTimeString.or(dateString.transform((d) => `${d}T00:00:00`)).optional(),
  to: dateTimeString.or(dateString.transform((d) => `${d}T00:00:00`)).optional(),
  workerId: id.optional(),
  projectId: id.optional(),
  taskId: id.optional(),
});
