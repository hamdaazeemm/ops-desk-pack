/** All desk times are Pakistan time (+05:00). Working hours 08:00–18:00, Monday–Friday (desk notes). */
const OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_START = 8;
const DAY_END = 18;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** End of the sampled day: the moment the demo opens on. */
export const DESK_START = '2026-03-12T17:30:00+05:00';

const local = (iso: string) => new Date(new Date(iso).getTime() + OFFSET_MS);

export function toDeskIso(ms: number): string {
  const d = new Date(ms + OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:00+05:00`;
}

export function deskNow(offsetMin: number): string {
  return toDeskIso(new Date(DESK_START).getTime() + offsetMin * 60000);
}

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** "27 February 2026" or "09 February" (year defaults to 2026) -> "2026-02-27" */
export function parseLooseDate(text: string, defaultYear = 2026): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
  if (!m) return null;
  const month = MONTH_NAMES.findIndex((n) => n.startsWith(m[2].toLowerCase().slice(0, 3)));
  if (month < 0) return null;
  const y = m[3] ? Number(m[3]) : defaultYear;
  return `${y}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function addWorkingDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend(d)) left--;
  }
  return d.toISOString().slice(0, 10);
}

/** Next given weekday on or after the day after `fromIso`. weekday: 0=Sun..6=Sat */
export function nextWeekday(fromIso: string, weekday: number): string {
  const d = local(fromIso);
  d.setUTCHours(0, 0, 0, 0);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== weekday);
  return d.toISOString().slice(0, 10);
}

/** Minutes of desk time (08:00–18:00, Mon–Fri) between two instants. */
export function workingMinutesBetween(aIso: string, bIso: string): number {
  let a = local(aIso).getTime();
  const b = local(bIso).getTime();
  if (b <= a) return 0;
  let total = 0;
  while (a < b) {
    const d = new Date(a);
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAY_START);
    const dayEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), DAY_END);
    if (!isWeekend(d)) {
      const s = Math.max(a, dayStart);
      const e = Math.min(b, dayEnd);
      if (e > s) total += (e - s) / 60000;
    }
    a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0);
  }
  return Math.round(total);
}

export function fmtAge(fromIso: string, nowIso: string): string {
  const mins = Math.max(0, (new Date(nowIso).getTime() - new Date(fromIso).getTime()) / 60000);
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / (60 * 24))}d`;
}

export function fmtWorkingMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtDesk(iso: string): string {
  const d = local(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function fmtTime(iso: string): string {
  const d = local(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function fmtDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Whole calendar days from now until a due date (negative = overdue). */
export function daysUntil(ymd: string, nowIso: string): number {
  const today = local(nowIso).toISOString().slice(0, 10);
  return Math.round((new Date(`${ymd}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86400000);
}
