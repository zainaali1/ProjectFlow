/**
 * Writes database/seed.sql from the AI-generated demo data, so you can load
 * demo data by pasting one script into the Azure portal Query editor.
 * Dates are written relative to GETDATE(), so the demo always looks current.
 *   npm run db:seed-sql
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildDemoData } from '../src/seed/buildDemoData.js';

const out = fileURLToPath(new URL('../../database/seed.sql', import.meta.url));
const data = buildDemoData();

const str = (v: string | null) => (v === null ? 'NULL' : `N'${v.replace(/'/g, "''")}'`);
const num = (v: number | null) => (v === null ? 'NULL' : String(v));
const day = (offset: number) => `DATEADD(day, ${offset}, @Today)`;
const at = (offset: number, minutes: number) => `DATEADD(minute, ${minutes}, CAST(${day(offset)} AS datetime2(0)))`;

const lines: string[] = [];
const push = (...l: string[]) => lines.push(...l);

push(
  '/* =====================================================================',
  '   ProjectFlow demo data (AI-generated content - see docs/AI_DEMO_DATA.md)',
  '   GENERATED FILE: edit api/src/seed/demoData.ts and run `npm run db:seed-sql`.',
  '   Run AFTER schema.sql. Replaces all existing rows.',
  '   ===================================================================== */',
  'SET NOCOUNT ON;',
  'SET XACT_ABORT ON;',
  'BEGIN TRANSACTION;',
  '',
  '-- Offsets are counted from the Monday of the current week (works for any DATEFIRST setting)',
  'DECLARE @Now date = CAST(GETDATE() AS date);',
  'DECLARE @Today date = DATEADD(day, -((DATEPART(weekday, @Now) + @@DATEFIRST - 2) % 7), @Now);',
  '',
  'DELETE FROM dbo.ScheduleEntries; DELETE FROM dbo.Tasks; DELETE FROM dbo.Projects; DELETE FROM dbo.Workers;',
  '',
  'SET IDENTITY_INSERT dbo.Workers ON;',
  'INSERT INTO dbo.Workers (WorkerId, FirstName, LastName, Email, Role, HourlyRate, IsActive) VALUES',
  data.workers
    .map((w) => `  (${w.workerId}, ${str(w.firstName)}, ${str(w.lastName)}, ${str(w.email)}, ${str(w.role)}, ${num(w.hourlyRate)}, 1)`)
    .join(',\n') + ';',
  'SET IDENTITY_INSERT dbo.Workers OFF;',
  '',
  'SET IDENTITY_INSERT dbo.Projects ON;',
  'INSERT INTO dbo.Projects (ProjectId, Name, Description, Status, StartDate, EndDate, Budget, Color) VALUES',
  data.projects
    .map(
      (p) =>
        `  (${p.projectId}, ${str(p.name)}, ${str(p.description)}, ${str(p.status)}, ${day(p.startOffset)}, ${day(p.endOffset)}, ${num(p.budget)}, '${p.color}')`,
    )
    .join(',\n') + ';',
  'SET IDENTITY_INSERT dbo.Projects OFF;',
  '',
  'SET IDENTITY_INSERT dbo.Tasks ON;',
  'INSERT INTO dbo.Tasks (TaskId, ProjectId, Title, Description, Status, Priority, EstimatedHours, DueDate) VALUES',
  data.tasks
    .map(
      (t) =>
        `  (${t.taskId}, ${t.projectId}, ${str(t.title)}, ${str(t.description)}, ${str(t.status)}, ${str(t.priority)}, ${num(t.estimatedHours)}, ${day(t.dueOffset)})`,
    )
    .join(',\n') + ';',
  'SET IDENTITY_INSERT dbo.Tasks OFF;',
  '',
  'SET IDENTITY_INSERT dbo.ScheduleEntries ON;',
  'INSERT INTO dbo.ScheduleEntries (ScheduleId, WorkerId, ProjectId, TaskId, StartTime, EndTime) VALUES',
  data.schedule
    .map(
      (s) =>
        `  (${s.scheduleId}, ${s.workerId}, ${s.projectId}, ${num(s.taskId)}, ${at(s.dayOffset, s.startMinutes)}, ${at(s.dayOffset, s.endMinutes)})`,
    )
    .join(',\n') + ';',
  'SET IDENTITY_INSERT dbo.ScheduleEntries OFF;',
  '',
  'COMMIT TRANSACTION;',
  `PRINT 'Seeded ${data.workers.length} workers, ${data.projects.length} projects, ${data.tasks.length} tasks, ${data.schedule.length} schedule entries.';`,
  '',
);

await writeFile(out, lines.join('\n'), 'utf8');
console.log(`Wrote ${out} (${data.schedule.length} schedule entries)`);
