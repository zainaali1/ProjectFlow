/** Date helpers. The API speaks local wall-clock strings: 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm:ss'. */

const pad = (n: number) => String(n).padStart(2, '0');

export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toDateTimeKey = (d: Date) => `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

/** Parses 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm(:ss)' as LOCAL time (never UTC). */
export function parseLocal(s: string): Date {
  const [datePart, timePart = '00:00'] = s.split('T');
  const [y, m, d] = datePart!.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y!, m! - 1, d!, hh ?? 0, mm ?? 0);
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const startOfWeek = (d: Date) => addDays(d, -((d.getDay() + 6) % 7)); // weeks start Monday
export const isSameDay = (a: Date, b: Date) => toDateKey(a) === toDateKey(b);

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export const formatDate = (s: string | null | undefined) => (s ? dateFmt.format(parseLocal(s)) : '—');
export const formatDay = (d: Date) => dayFmt.format(d);
export const formatTime = (s: string) => timeFmt.format(parseLocal(s));
export const formatMonth = (d: Date) => monthFmt.format(d);
export const hoursBetween = (start: string, end: string) => (parseLocal(end).getTime() - parseLocal(start).getTime()) / 3_600_000;

export const weekdayLabels = (() => {
  const f = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const monday = startOfWeek(new Date(2024, 0, 3));
  return Array.from({ length: 7 }, (_, i) => f.format(addDays(monday, i)));
})();

export const todayKey = () => toDateKey(new Date());
