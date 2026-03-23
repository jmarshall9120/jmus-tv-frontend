/** Day-of-week labels in weekday order (Mon first). */
export const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

const FULL_TO_SHORT_DOW: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun'
}

/**
 * Normalize day-of-week from data (e.g. "Saturday", "Wednesday") to short form (Mon, Tue, …).
 * Pass-through if already short or unknown.
 */
export function normalizeDayOfWeek (dow: string): string {
  if (!dow || typeof dow !== 'string') return '—'
  const trimmed = dow.trim()
  return FULL_TO_SHORT_DOW[trimmed] ?? trimmed
}

/**
 * Extract day of week from an ISO date string (YYYY-MM-DD).
 * Returns short label (Mon, Tue, ...) or "—" if invalid.
 */
export function dayOfWeekFromDate (dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '—'
  const d = new Date(dateStr.trim())
  if (Number.isNaN(d.getTime())) return '—'
  // getDay(): 0 = Sun, 1 = Mon, ... 6 = Sat → map to Mon-first index
  const index = (d.getDay() + 6) % 7
  return DOW_ORDER[index]
}

/**
 * Parsed date/time parts: exactly as written, no timezone conversion.
 */
export interface NaiveDateTime {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/**
 * Parse a date_time string as naive numbers (no timezone).
 * Uses the digits exactly as written; ignores Z, +00:00, -05:00, etc.
 * Accepts: "2025-02-01 16:15:45", "2025-02-01T16:15:45", "2025-02-01T16:15:45Z", etc.
 */
export function parseDateTimeNaive (dateTimeStr: string | null | undefined): NaiveDateTime | null {
  const raw = dateTimeStr != null ? String(dateTimeStr).trim() : ''
  if (!raw) return null
  const withoutTz = raw.replace(/\s*(Z|[+-]\d{2}:?\d{2})\s*$/i, '').trim()
  const match = withoutTz.match(/^(\d{4})-(\d{2})-(\d{2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?/)
  if (!match) return null
  const [, y, mo, d, h, min, sec] = match
  const year = parseInt(y!, 10)
  const month = parseInt(mo!, 10)
  const day = parseInt(d!, 10)
  const hour = parseInt(h!, 10)
  const minute = parseInt(min!, 10)
  const second = parseInt(sec ?? '0', 10)
  if (Number.isNaN(year + month + day + hour + minute + second)) return null
  return { year, month, day, hour, minute, second }
}

/** Hour (0–23) from naive date/time. No timezone; use the value as written. */
export function getNaiveHour (naive: NaiveDateTime): number {
  return Math.min(23, Math.max(0, naive.hour))
}

/** Timestamp for ordering only: same numbers, no shift. */
export function naiveToTimestamp (naive: NaiveDateTime): number {
  return Date.UTC(naive.year, naive.month - 1, naive.day, naive.hour, naive.minute, naive.second)
}

/** Day-of-week label (Mon–Sun) from naive date parts. No timezone. */
export function getNaiveDayOfWeek (naive: NaiveDateTime): string {
  const utc = Date.UTC(naive.year, naive.month - 1, naive.day)
  const day = new Date(utc).getUTCDay()
  return DOW_ORDER[(day + 6) % 7]
}

/**
 * Monday of the week containing d (UTC).
 * Used for week-based API filters (week_start, week_end).
 */
export function getWeekStartDate (d: Date): Date {
  const day = d.getUTCDay()
  const diff = (day + 6) % 7 // Mon=0, Sun=6
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

/** Format Date as YYYY-MM-DD (UTC date parts). */
export function formatDateUTC (d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Last Monday (start of last completed week) as YYYY-MM-DD.
 * Used to exclude future weeks from the dashboard.
 */
export function getLastMondayDateString (): string {
  const now = new Date()
  const thisMonday = getWeekStartDate(now)
  const lastMonday = new Date(thisMonday)
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7)
  return formatDateUTC(lastMonday)
}

/**
 * Week range for initial dashboard fetch: last N completed weeks (last Monday = end).
 * Use for the API request; the dropdown is built from actual data returned.
 */
export function getLastWeeksRange (numWeeks: number): { weekStart: string; weekEnd: string } {
  const weekEnd = getLastMondayDateString()
  const weekEndDate = new Date(weekEnd + 'T00:00:00.000Z')
  const weekStartDate = new Date(weekEndDate)
  weekStartDate.setUTCDate(weekEndDate.getUTCDate() - 7 * (numWeeks - 1))
  const weekStart = formatDateUTC(weekStartDate)
  return { weekStart, weekEnd }
}
