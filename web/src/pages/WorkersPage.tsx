import { useState } from 'react';
import { useLoad } from '../api/ApiContext';
import type { Worker } from '../api/types';
import { WorkerForm } from '../components/forms';
import { EmptyState, ErrorNotice, Loading, PageHeader } from '../components/ui';
import { Link } from '../router';
import { addDays, hoursBetween, startOfWeek, toDateKey } from '../utils/dates';

export function WorkersPage() {
  const weekStart = startOfWeek(new Date());
  const data = useLoad(async (api) => {
    const [workers, week] = await Promise.all([api.workers(), api.schedule({ from: toDateKey(weekStart), to: toDateKey(addDays(weekStart, 7)) })]);
    const hours = new Map<number, number>();
    week.forEach((e) => hours.set(e.workerId, (hours.get(e.workerId) ?? 0) + hoursBetween(e.startTime, e.endTime)));
    return { workers, hours };
  });
  const [editing, setEditing] = useState<Worker | null | undefined>(undefined);

  return (
    <div className="page">
      <PageHeader
        title="People"
        intro="Everyone who can be booked onto project work, with their hours this week."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing(null)}>
            Add a person
          </button>
        }
      />
      {data.error && <ErrorNotice error={data.error} onRetry={data.reload} />}
      {!data.data && !data.error && <Loading />}
      {data.data && data.data.workers.length === 0 && <EmptyState title="Nobody here yet">Add the people on your team so you can schedule them.</EmptyState>}
      {data.data && data.data.workers.length > 0 && (
        <ul className="people">
          {data.data.workers.map((w) => {
            const h = Math.round((data.data!.hours.get(w.workerId) ?? 0) * 10) / 10;
            const load = Math.min(100, (h / 40) * 100);
            return (
              <li key={w.workerId} className={`person${w.isActive ? '' : ' inactive'}`}>
                <span className="avatar large" aria-hidden="true">
                  {w.firstName[0]}
                  {w.lastName[0]}
                </span>
                <div className="person-text">
                  <button className="link-btn person-name" onClick={() => setEditing(w)}>
                    {w.firstName} {w.lastName}
                  </button>
                  <span className="muted">{w.role}</span>
                  <a className="muted-link small" href={`mailto:${w.email}`}>
                    {w.email}
                  </a>
                </div>
                <div className="person-load" title={`${h} of 40 hours booked this week`}>
                  <span className="load-figure">{h} h</span>
                  <span className="load-bar">
                    <span style={{ width: `${load}%` }} className={h > 40 ? 'over' : ''} />
                  </span>
                  {w.isActive ? (
                    <Link to={`/schedule?view=list&worker=${w.workerId}`} className="muted-link small">
                      See schedule
                    </Link>
                  ) : (
                    <span className="muted small">Not available</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing !== undefined && (
        <WorkerForm
          open
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            data.reload();
          }}
        />
      )}
    </div>
  );
}
