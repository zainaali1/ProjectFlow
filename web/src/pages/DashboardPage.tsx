import { useLoad } from '../api/ApiContext';
import { useAuth } from '../auth/AuthContext';
import { ErrorNotice, Loading, ProgressBar, StatusBadge } from '../components/ui';
import { Link } from '../router';
import { addDays, formatDay, formatTime, isSameDay, parseLocal, startOfWeek, toDateKey, weekdayLabels } from '../utils/dates';

export function DashboardPage() {
  const { user } = useAuth();
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const data = useLoad(async (api) => {
    const [summary, projects, week] = await Promise.all([
      api.dashboard(),
      api.projects(),
      api.schedule({ from: toDateKey(weekStart), to: toDateKey(addDays(weekStart, 7)) }),
    ]);
    return { summary, projects, week };
  });

  if (data.error) return <ErrorNotice error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading />;
  const { summary, projects, week } = data.data;
  const openTasks = summary.tasks.total - summary.tasks.byStatus.Done;
  const today = new Date();

  return (
    <div className="page">
      <header className="greeting">
        <p className="greeting-date">{formatDay(today)}</p>
        <h1>Hello, {user.name.split(' ')[0]}</h1>
      </header>

      <dl className="figures">
        <div>
          <dt>Active projects</dt>
          <dd>{summary.projects.byStatus.Active}</dd>
        </div>
        <div>
          <dt>Open tasks</dt>
          <dd>{openTasks}</dd>
        </div>
        <div className={summary.tasks.overdue ? 'warn' : ''}>
          <dt>Overdue</dt>
          <dd>{summary.tasks.overdue}</dd>
        </div>
        <div>
          <dt>Booked this week</dt>
          <dd>
            {summary.hoursScheduledThisWeek}
            <small> h</small>
          </dd>
        </div>
      </dl>

      <section className="panel">
        <div className="panel-head">
          <h2>This week</h2>
          <Link to="/schedule" className="text-link">
            Open schedule
          </Link>
        </div>
        <div className="week-wall">
          {days.map((d, i) => {
            const entries = week.filter((e) => isSameDay(parseLocal(e.startTime), d));
            return (
              <div key={i} className={`wall-day${isSameDay(d, today) ? ' is-today' : ''}`}>
                <div className="wall-day-head">
                  <span>{weekdayLabels[i]}</span>
                  <strong>{d.getDate()}</strong>
                </div>
                <ul className="wall-entries">
                  {entries.length === 0 && <li className="wall-empty">Nothing booked</li>}
                  {entries.map((e) => (
                    <li key={e.scheduleId} className="tape" style={{ '--tape': e.projectColor } as React.CSSProperties}>
                      <span className="tape-time">{formatTime(e.startTime)}</span>
                      <span className="tape-who">{e.workerName}</span>
                      <span className="tape-what">{e.taskTitle ?? e.projectName}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Projects</h2>
          <Link to="/projects" className="text-link">
            All projects
          </Link>
        </div>
        <ul className="project-progress">
          {projects
            .filter((p) => p.status !== 'Completed')
            .map((p) => (
              <li key={p.projectId}>
                <Link to={`/projects/${p.projectId}`} className="pp-row">
                  <span className="dot" style={{ background: p.color }} aria-hidden="true" />
                  <span className="pp-name">{p.name}</span>
                  <StatusBadge status={p.status} />
                  <span className="pp-count">
                    {p.doneTaskCount ?? 0}/{p.taskCount ?? 0} done
                  </span>
                  <ProgressBar done={p.doneTaskCount ?? 0} total={p.taskCount ?? 0} color={p.color} />
                </Link>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
