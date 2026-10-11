import { useState } from 'react';
import { useLoad } from '../api/ApiContext';
import type { Project } from '../api/types';
import { ProjectForm } from '../components/forms';
import { EmptyState, ErrorNotice, Loading, PageHeader, ProgressBar, StatusBadge } from '../components/ui';
import { Link } from '../router';
import { formatDate } from '../utils/dates';

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function ProjectsPage() {
  const projects = useLoad((api) => api.projects());
  const [editing, setEditing] = useState<Project | null | undefined>(undefined); // undefined = closed, null = new
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const list = (projects.data ?? []).filter((p) => filter === 'all' || p.status !== 'Completed');

  return (
    <div className="page">
      <PageHeader
        title="Projects"
        intro="Everything the team is delivering, with progress counted from finished tasks."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing(null)}>
            New project
          </button>
        }
      />
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Show">
          <button aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>
            In progress
          </button>
          <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </button>
        </div>
      </div>

      {projects.error && <ErrorNotice error={projects.error} onRetry={projects.reload} />}
      {!projects.data && !projects.error && <Loading />}
      {projects.data && list.length === 0 && (
        <EmptyState title="No projects yet" action={<button className="btn btn-primary" onClick={() => setEditing(null)}>New project</button>}>
          Create a project, then break it into tasks and book people onto them.
        </EmptyState>
      )}

      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Dates</th>
                <th className="num">Budget</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.projectId}>
                  <td data-label="Project">
                    <Link to={`/projects/${p.projectId}`} className="row-title">
                      <span className="dot" style={{ background: p.color }} aria-hidden="true" />
                      {p.name}
                    </Link>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={p.status} />
                  </td>
                  <td data-label="Dates" className="muted">
                    {formatDate(p.startDate)} – {formatDate(p.endDate)}
                  </td>
                  <td data-label="Budget" className="num">
                    {p.budget === null ? '—' : money.format(p.budget)}
                  </td>
                  <td data-label="Progress" className="progress-cell">
                    <ProgressBar done={p.doneTaskCount ?? 0} total={p.taskCount ?? 0} color={p.color} />
                    <span className="muted small">
                      {p.doneTaskCount}/{p.taskCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== undefined && (
        <ProjectForm
          open
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            projects.reload();
          }}
        />
      )}
    </div>
  );
}
