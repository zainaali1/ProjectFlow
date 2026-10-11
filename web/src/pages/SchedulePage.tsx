import { useState } from 'react';
import { useLoad } from '../api/ApiContext';
import type { ScheduleEntry } from '../api/types';
import { ScheduleForm } from '../components/forms';
import { EmptyState, ErrorNotice, Loading, PageHeader } from '../components/ui';
import {
  addDays,
  formatDay,
  formatMonth,
  formatTime,
  hoursBetween,
  isSameDay,
  parseLocal,
  startOfMonth,
  startOfWeek,
  toDateKey,
  todayKey,
  weekdayLabels,
} from '../utils/dates';

type View = 'calendar' | 'list';

/** Filters live in the URL (?view=list&month=2026-10&worker=3) so views can be bookmarked and shared. */
function readParams() {
  const p = new URLSearchParams(window.location.search);
  const m = p.get('month');
  const month = m && /^\d{4}-\d{2}$/.test(m) ? new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1) : startOfMonth(new Date());
  return {
    view: (p.get('view') === 'list' ? 'list' : 'calendar') as View,
    month,
    worker: p.get('worker') ?? '',
    project: p.get('project') ?? '',
  };
}

function writeParams(s: ReturnType<typeof readParams>) {
  const p = new URLSearchParams();
  if (s.view === 'list') p.set('view', 'list');
  p.set('month', toDateKey(s.month).slice(0, 7));
  if (s.worker) p.set('worker', s.worker);
  if (s.project) p.set('project', s.project);
  window.history.replaceState({}, '', `/schedule?${p}`);
}

export function SchedulePage() {
  const [state, setStateRaw] = useState(readParams);
  const setState = (patch: Partial<typeof state>) => {
    const next = { ...state, ...patch };
    writeParams(next);
    setStateRaw(next);
  };
  const { view, month, worker, project } = state;

  const gridStart = startOfWeek(month);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const gridEnd = addDays(startOfWeek(addDays(nextMonth, -1)), 7);

  const workers = useLoad((api) => api.workers());
  const projects = useLoad((api) => api.projects());
  const entries = useLoad(
    (api) =>
      api.schedule({
        from: toDateKey(view === 'calendar' ? gridStart : month),
        to: toDateKey(view === 'calendar' ? gridEnd : nextMonth),
        workerId: worker ? Number(worker) : undefined,
        projectId: project ? Number(project) : undefined,
      }),
    [view, toDateKey(month), worker, project],
  );

  const [selectedDay, setSelectedDay] = useState<string>(todayKey());
  const [editing, setEditing] = useState<ScheduleEntry | null | undefined>(undefined);
  const [newDate, setNewDate] = useState<string | undefined>();

  const byDay = new Map<string, ScheduleEntry[]>();
  (entries.data ?? []).forEach((e) => {
    const k = e.startTime.slice(0, 10);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  });

  const shiftMonth = (n: number) => setState({ month: new Date(month.getFullYear(), month.getMonth() + n, 1) });
  const book = (date?: string) => {
    setNewDate(date);
    setEditing(null);
  };

  return (
    <div className="page page-wide">
      <PageHeader
        title="Schedule"
        intro="Who is working on which project and task, and when."
        actions={
          <button className="btn btn-primary" onClick={() => book(view === 'calendar' ? selectedDay : undefined)}>
            Book time
          </button>
        }
      />

      <div className="toolbar schedule-toolbar">
        <div className="month-nav">
          <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2 aria-live="polite">{formatMonth(month)}</h2>
          <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
            ›
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => {
              setSelectedDay(todayKey());
              setState({ month: startOfMonth(new Date()) });
            }}
          >
            Today
          </button>
        </div>
        <label className="filter">
          <span>Person</span>
          <select value={worker} onChange={(e) => setState({ worker: e.target.value })}>
            <option value="">Everyone</option>
            {workers.data?.map((w) => (
              <option key={w.workerId} value={w.workerId}>
                {w.firstName} {w.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Project</span>
          <select value={project} onChange={(e) => setState({ project: e.target.value })}>
            <option value="">All projects</option>
            {projects.data?.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" role="group" aria-label="View">
          <button aria-pressed={view === 'calendar'} onClick={() => setState({ view: 'calendar' })}>
            Calendar
          </button>
          <button aria-pressed={view === 'list'} onClick={() => setState({ view: 'list' })}>
            List
          </button>
        </div>
      </div>

      {entries.error && <ErrorNotice error={entries.error} onRetry={entries.reload} />}
      {!entries.data && !entries.error && <Loading />}

      {entries.data && view === 'calendar' && (
        <CalendarView
          gridStart={gridStart}
          gridEnd={gridEnd}
          month={month}
          byDay={byDay}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onOpen={setEditing}
          onBook={book}
        />
      )}

      {entries.data && view === 'list' && <ListView byDay={byDay} onOpen={setEditing} onBook={() => book()} />}

      {editing !== undefined && (
        <ScheduleForm
          open
          existing={editing}
          defaultDate={newDate}
          defaultProjectId={project ? Number(project) : undefined}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            entries.reload();
          }}
        />
      )}
    </div>
  );
}

function Tape({ e, onOpen, showWho = true }: { e: ScheduleEntry; onOpen: (e: ScheduleEntry) => void; showWho?: boolean }) {
  return (
    <button
      className="tape"
      style={{ '--tape': e.projectColor } as React.CSSProperties}
      onClick={(ev) => {
        ev.stopPropagation();
        onOpen(e);
      }}
      title={`${formatTime(e.startTime)}–${formatTime(e.endTime)} ${e.workerName}: ${e.taskTitle ?? e.projectName}`}
    >
      <span className="tape-time">{formatTime(e.startTime)}</span>
      {showWho && <span className="tape-who">{e.workerName?.split(' ')[0]}</span>}
      <span className="tape-what">{e.taskTitle ?? e.projectName}</span>
    </button>
  );
}

function CalendarView(props: {
  gridStart: Date;
  gridEnd: Date;
  month: Date;
  byDay: Map<string, ScheduleEntry[]>;
  selectedDay: string;
  onSelectDay: (d: string) => void;
  onOpen: (e: ScheduleEntry) => void;
  onBook: (date: string) => void;
}) {
  const { gridStart, gridEnd, month, byDay, selectedDay, onSelectDay, onOpen, onBook } = props;
  const days: Date[] = [];
  for (let d = gridStart; d < gridEnd; d = addDays(d, 1)) days.push(d);
  const today = new Date();
  const selected = byDay.get(selectedDay) ?? [];
  const MAX = 3;

  return (
    <div className="calendar-layout">
      <div className="calendar" role="grid" aria-label={formatMonth(month)}>
        <div className="cal-head" role="row">
          {weekdayLabels.map((l) => (
            <div key={l} role="columnheader">
              {l}
            </div>
          ))}
        </div>
        <div className="cal-body">
          {days.map((d) => {
            const key = toDateKey(d);
            const list = byDay.get(key) ?? [];
            const outside = d.getMonth() !== month.getMonth();
            const weekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={key}
                role="gridcell"
                tabIndex={0}
                aria-selected={key === selectedDay}
                aria-label={`${formatDay(d)}, ${list.length} bookings`}
                className={['cal-cell', outside && 'outside', weekend && 'weekend', isSameDay(d, today) && 'is-today', key === selectedDay && 'selected']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectDay(key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDay(key);
                  }
                }}
              >
                <span className="cal-date">{d.getDate()}</span>
                <div className="cal-tapes">
                  {list.slice(0, MAX).map((e) => (
                    <Tape key={e.scheduleId} e={e} onOpen={onOpen} />
                  ))}
                  {list.length > MAX && <span className="cal-more">{list.length - MAX} more</span>}
                </div>
                {list.length > 0 && (
                  <span className="cal-dots" aria-hidden="true">
                    {list.slice(0, 4).map((e) => (
                      <i key={e.scheduleId} style={{ background: e.projectColor }} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="day-panel" aria-live="polite">
        <div className="panel-head">
          <h3>{formatDay(parseLocal(selectedDay))}</h3>
          <button className="btn btn-quiet" onClick={() => onBook(selectedDay)}>
            Book this day
          </button>
        </div>
        {selected.length === 0 ? (
          <p className="muted">Nothing booked.</p>
        ) : (
          <ul className="agenda">
            {selected.map((e) => (
              <li key={e.scheduleId}>
                <button className="agenda-item" onClick={() => onOpen(e)} style={{ '--tape': e.projectColor } as React.CSSProperties}>
                  <span className="agenda-when">
                    {formatTime(e.startTime)}–{formatTime(e.endTime)}
                  </span>
                  <span className="agenda-who">{e.workerName}</span>
                  <span className="agenda-what">
                    {e.projectName}
                    {e.taskTitle && <>: {e.taskTitle}</>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function ListView({ byDay, onOpen, onBook }: { byDay: Map<string, ScheduleEntry[]>; onOpen: (e: ScheduleEntry) => void; onBook: () => void }) {
  const days = [...byDay.keys()].sort();
  if (days.length === 0) {
    return (
      <EmptyState title="Nothing booked this month" action={<button className="btn btn-primary" onClick={onBook}>Book time</button>}>
        Try another month or clear the filters.
      </EmptyState>
    );
  }
  const today = todayKey();
  return (
    <div className="schedule-list">
      {days.map((day) => {
        const list = byDay.get(day)!;
        const total = list.reduce((s, e) => s + hoursBetween(e.startTime, e.endTime), 0);
        return (
          <section key={day} className={`list-day${day === today ? ' is-today' : ''}${day < today ? ' past' : ''}`}>
            <h3>
              {formatDay(parseLocal(day))}
              <span className="muted small">{Math.round(total * 10) / 10} h booked</span>
            </h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Person</th>
                    <th>Project</th>
                    <th>Task</th>
                    <th className="num">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.scheduleId} className="clickable" onClick={() => onOpen(e)}>
                      <td data-label="Time">
                        <button className="link-btn" onClick={() => onOpen(e)}>
                          {formatTime(e.startTime)}–{formatTime(e.endTime)}
                        </button>
                      </td>
                      <td data-label="Person">{e.workerName}</td>
                      <td data-label="Project">
                        <span className="dot" style={{ background: e.projectColor }} aria-hidden="true" /> {e.projectName}
                      </td>
                      <td data-label="Task" className="muted">
                        {e.taskTitle ?? 'General project work'}
                      </td>
                      <td data-label="Hours" className="num">
                        {hoursBetween(e.startTime, e.endTime)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
