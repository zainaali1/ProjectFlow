/**
 * Loads the AI-generated demo data into Azure SQL.
 *   npm run db:seed            (only if the tables are empty)
 *   npm run db:seed -- --force (deletes existing rows first)
 */
import sql from 'mssql';
import { loadConfig } from '../src/config.js';
import { createPool } from '../src/data/mssqlRepository.js';
import { buildDemoData } from '../src/seed/buildDemoData.js';

const force = process.argv.includes('--force');
const config = loadConfig();
const pool = await createPool(config.sql);
const data = buildDemoData();

try {
  const existing = await pool.request().query<{ n: number }>('SELECT COUNT(*) AS n FROM dbo.Projects');
  if (existing.recordset[0]!.n > 0 && !force) {
    console.error('Database already has data. Re-run with --force to replace it.');
    process.exitCode = 1;
  } else {
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const run = (q: string) => new sql.Request(tx).batch(q);
      await run('DELETE FROM dbo.ScheduleEntries; DELETE FROM dbo.Tasks; DELETE FROM dbo.Projects; DELETE FROM dbo.Workers;');

      // Keep the demo ids stable so seed.sql and this script produce identical data.
      await run('SET IDENTITY_INSERT dbo.Workers ON');
      for (const w of data.workers) {
        await new sql.Request(tx)
          .input('id', sql.Int, w.workerId).input('fn', sql.NVarChar, w.firstName).input('ln', sql.NVarChar, w.lastName)
          .input('email', sql.NVarChar, w.email).input('role', sql.NVarChar, w.role).input('rate', sql.Decimal(10, 2), w.hourlyRate)
          .query('INSERT INTO dbo.Workers (WorkerId, FirstName, LastName, Email, Role, HourlyRate, IsActive) VALUES (@id,@fn,@ln,@email,@role,@rate,1)');
      }
      await run('SET IDENTITY_INSERT dbo.Workers OFF; SET IDENTITY_INSERT dbo.Projects ON');
      for (const p of data.projects) {
        await new sql.Request(tx)
          .input('id', sql.Int, p.projectId).input('name', sql.NVarChar, p.name).input('desc', sql.NVarChar, p.description)
          .input('status', sql.NVarChar, p.status).input('start', sql.VarChar, p.startDate).input('end', sql.VarChar, p.endDate)
          .input('budget', sql.Decimal(12, 2), p.budget).input('color', sql.Char(7), p.color)
          .query(`INSERT INTO dbo.Projects (ProjectId, Name, Description, Status, StartDate, EndDate, Budget, Color)
                  VALUES (@id,@name,@desc,@status,CONVERT(date,@start,23),CONVERT(date,@end,23),@budget,@color)`);
      }
      await run('SET IDENTITY_INSERT dbo.Projects OFF; SET IDENTITY_INSERT dbo.Tasks ON');
      for (const t of data.tasks) {
        await new sql.Request(tx)
          .input('id', sql.Int, t.taskId).input('pid', sql.Int, t.projectId).input('title', sql.NVarChar, t.title)
          .input('desc', sql.NVarChar, t.description).input('status', sql.NVarChar, t.status).input('prio', sql.NVarChar, t.priority)
          .input('hours', sql.Decimal(6, 2), t.estimatedHours).input('due', sql.VarChar, t.dueDate)
          .query(`INSERT INTO dbo.Tasks (TaskId, ProjectId, Title, Description, Status, Priority, EstimatedHours, DueDate)
                  VALUES (@id,@pid,@title,@desc,@status,@prio,@hours,CONVERT(date,@due,23))`);
      }
      await run('SET IDENTITY_INSERT dbo.Tasks OFF; SET IDENTITY_INSERT dbo.ScheduleEntries ON');
      for (const s of data.schedule) {
        await new sql.Request(tx)
          .input('id', sql.Int, s.scheduleId).input('wid', sql.Int, s.workerId).input('pid', sql.Int, s.projectId)
          .input('tid', sql.Int, s.taskId).input('start', sql.VarChar, s.startTime).input('end', sql.VarChar, s.endTime)
          .query(`INSERT INTO dbo.ScheduleEntries (ScheduleId, WorkerId, ProjectId, TaskId, StartTime, EndTime)
                  VALUES (@id,@wid,@pid,@tid,CONVERT(datetime2(0),@start,126),CONVERT(datetime2(0),@end,126))`);
      }
      await run('SET IDENTITY_INSERT dbo.ScheduleEntries OFF');
      await tx.commit();
      console.log(
        `Seeded ${data.workers.length} workers, ${data.projects.length} projects, ${data.tasks.length} tasks, ${data.schedule.length} schedule entries.`,
      );
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
} finally {
  await pool.close();
}
