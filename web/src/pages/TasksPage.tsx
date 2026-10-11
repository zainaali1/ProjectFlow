import { useState } from 'react';
import { useLoad } from '../api/ApiContext';
import { TASK_STATUSES, type Task, type TaskStatus } from '../api/types';
import { TaskForm } from '../components/forms';
import { EmptyState, ErrorNotice, Loading, PageHeader, PriorityMark, STATUS_LABEL, StatusBadge } from '../components/ui';
import { Link } from '../router';
import { formatDate, todayKey } from '../utils/dates';

export function TasksPage() {
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState<TaskStatus | '' | 'open'>('open');
  const [search, setSearch] = useState('');
  const projects = useLoad((api) => api.projects());
  const tasks = useLoad((api) => api.tasks({ projectId: projectId ? Number(projectId) : undefined, status: status && status !== 'open' ? status : undefined }), [projectId, status]);
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);

  const q = search.trim().toLowerCase();
  const list = (tasks.data ?? []).filter((t) => (status !== 'open' || t.status !== 'Done')).filter((t) => !q || t.title.toLowerCase().includes(q) || (t.projectName ?? '').toLowerCase().includes(q));
  const today = todayKey();

  return (
    <div className="page">
      <PageHeader
        title="Tasks"
        intro="Every task across all projects, soonest due first."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing(null)}>
            New task
          </button>
        }
      />
      <div className="toolbar filters">
        <label className="filter">
          <span>Search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Task or project" />
        </label>
        <label className="filter">
          <span>Project</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | '' | 'open')}>
            <option value="open">Not done yet</option>
            <option value="">Any status</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tasks.error && <ErrorNotice error={tasks.error} onRetry={tasks.reload} />}
      {!tasks.data && !tasks.error && <Loading />}
      {tasks.data && list.length === 0 && <EmptyState title="No tasks match">Change the filters, or add a task.</EmptyState>}

      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Due</th>
                <th className="num">Estimate</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.taskId}>
                  <td data-label="Task">
                    <button className="row-title link-btn" onClick={() => setEditing(t)}>
                      {t.title}
                    </button>
                  </td>
                  <td data-label="Project">
                    <Link to={`/projects/${t.projectId}`} className="muted-link">
                      {t.projectName}
                    </Link>
                  </td>
                  <td data-label="Status">
                    <StatusBadge status={t.status} />
                  </td>
                  <td data-label="Priority">
                    <PriorityMark priority={t.priority} />
                  </td>
                  <td data-label="Due" className={t.status !== 'Done' && t.dueDate && t.dueDate < today ? 'overdue' : 'muted'}>
                    {formatDate(t.dueDate)}
                  </td>
                  <td data-label="Estimate" className="num">
                    {t.estimatedHours === null ? '—' : `${t.estimatedHours} h`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing !== undefined && (
        <TaskForm
          open
          existing={editing}
          defaultProjectId={projectId ? Number(projectId) : undefined}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            tasks.reload();
          }}
        />
      )}
    </div>
  );
}
