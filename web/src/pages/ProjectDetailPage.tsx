import { useState } from 'react';
import { useLoad } from '../api/ApiContext';
import { TASK_STATUSES, type Task } from '../api/types';
import { ProjectForm, ScheduleForm, TaskForm } from '../components/forms';
import { EmptyState, ErrorNotice, Loading, PriorityMark, ProgressBar, STATUS_LABEL, StatusBadge } from '../components/ui';
import { Link, navigate } from '../router';
import { formatDate, formatDay, formatTime, parseLocal, todayKey } from '../utils/dates';

export function ProjectDetailPage({ id }: { id: number }) {
  const data = useLoad(
    async (api) => {
      const [project, tasks, upcoming] = await Promise.all([api.project(id), api.tasks({ projectId: id }), api.schedule({ projectId: id, from: todayKey() })]);
      return { project, tasks, upcoming };
    },
    [id],
  );
  const [editProject, setEditProject] = useState(false);
  const [editTask, setEditTask] = useState<Task | null | undefined>(undefined);
  const [booking, setBooking] = useState(false);

  if (data.error) return <ErrorNotice error={data.error} onRetry={data.reload} />;
  if (!data.data) return <Loading />;
  const { project, tasks, upcoming } = data.data;

  return (
    <div className="page">
      <Link to="/projects" className="back-link">
        All projects
      </Link>
      <header className="project-hero" style={{ '--project': project.color } as React.CSSProperties}>
        <div className="project-hero-text">
          <h1>{project.name}</h1>
          {project.description && <p>{project.description}</p>}
          <div className="meta-row">
            <StatusBadge status={project.status} />
            <span className="muted">
              {formatDate(project.startDate)} – {formatDate(project.endDate)}
            </span>
          </div>
        </div>
        <div className="project-hero-side">
          <ProgressBar done={project.doneTaskCount ?? 0} total={project.taskCount ?? 0} color={project.color} />
          <p className="muted small">
            {project.doneTaskCount} of {project.taskCount} tasks done
          </p>
          <div className="btn-row">
            <button className="btn btn-quiet" onClick={() => setEditProject(true)}>
              Edit project
            </button>
            <button className="btn btn-primary" onClick={() => setEditTask(null)}>
              Add task
            </button>
          </div>
        </div>
      </header>

      {tasks.length === 0 ? (
        <EmptyState title="No tasks in this project" action={<button className="btn btn-primary" onClick={() => setEditTask(null)}>Add task</button>}>
          Break the work into tasks so people can be booked onto them.
        </EmptyState>
      ) : (
        <div className="board">
          {TASK_STATUSES.map((status) => {
            const column = tasks.filter((t) => t.status === status);
            return (
              <section key={status} className={`board-col col-${status.toLowerCase()}`} aria-label={STATUS_LABEL[status]}>
                <h2>
                  {STATUS_LABEL[status]} <span className="count">{column.length}</span>
                </h2>
                <ul>
                  {column.map((t) => (
                    <li key={t.taskId}>
                      <button className="card-btn" onClick={() => setEditTask(t)}>
                        <span className="card-title">{t.title}</span>
                        <span className="card-meta">
                          <PriorityMark priority={t.priority} />
                          {t.dueDate && <span className={t.status !== 'Done' && t.dueDate < todayKey() ? 'overdue' : 'muted'}>Due {formatDate(t.dueDate)}</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>Coming up</h2>
          <button className="btn btn-quiet" onClick={() => setBooking(true)} disabled={project.status === 'Completed'}>
            Book time
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="muted">Nobody is booked on this project yet.</p>
        ) : (
          <ul className="agenda compact">
            {upcoming.slice(0, 8).map((e) => (
              <li key={e.scheduleId}>
                <span className="agenda-when">
                  {formatDay(parseLocal(e.startTime))}, {formatTime(e.startTime)}–{formatTime(e.endTime)}
                </span>
                <span>
                  <strong>{e.workerName}</strong> {e.taskTitle ? `on ${e.taskTitle}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editProject && (
        <ProjectForm
          open
          existing={project}
          onClose={() => setEditProject(false)}
          onSaved={() => {
            setEditProject(false);
            data.reload();
          }}
          onDeleted={() => navigate('/projects')}
        />
      )}
      {editTask !== undefined && (
        <TaskForm
          open
          existing={editTask}
          defaultProjectId={project.projectId}
          onClose={() => setEditTask(undefined)}
          onSaved={() => {
            setEditTask(undefined);
            data.reload();
          }}
        />
      )}
      {booking && (
        <ScheduleForm
          open
          defaultProjectId={project.projectId}
          defaultDate={todayKey()}
          onClose={() => setBooking(false)}
          onSaved={() => {
            setBooking(false);
            data.reload();
          }}
        />
      )}
    </div>
  );
}
