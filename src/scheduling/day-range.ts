import { fromZonedTime, formatInTimeZone } from 'date-fns-tz'

/** A calendar date as the address bar and the API both spell it: `yyyy-MM-dd`. */
export type CalendarDate = string

function parts(date: CalendarDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number]

  return { year, month: month - 1, day }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * `Date.UTC` and its own getters, never `fromZonedTime`/`toZonedTime`'s: this
 * is calendar normalisation only — rolling day 31 of a 30-day month into the
 * 1st of the next — and is correct however the host's own clock is set,
 * because nothing here claims to represent a moment in any particular zone
 * yet.
 */
function normalizeCalendarDate(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const normalized = new Date(Date.UTC(year, month, day))

  return { year: normalized.getUTCFullYear(), month: normalized.getUTCMonth(), day: normalized.getUTCDate() }
}

/**
 * A wall-clock date and time with no zone attached, in the one string format
 * `fromZonedTime` treats as "these digits, in whichever zone I'm told" rather
 * than reading through the host's own local getters. Passing it a `Date`
 * object instead is the trap: `fromZonedTime` reads a `Date` argument's
 * fields via the host's local timezone, not UTC, so its result would silently
 * depend on which machine ran the code.
 */
export function naiveLocalIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const normalized = normalizeCalendarDate(year, month, day)

  return `${normalized.year}-${pad(normalized.month + 1)}-${pad(normalized.day)}T${pad(hour)}:${pad(minute)}:00`
}

/** Today, as the Shop's own calendar reads it right now — never the viewer's. */
export function todayInShop(shopTimezone: string): CalendarDate {
  return formatInTimeZone(new Date(), shopTimezone, 'yyyy-MM-dd')
}

/**
 * A calendar date shifted by whole days. Going through `Date.UTC` — rather
 * than adding `24 * 60 * 60 * 1000` milliseconds — is what makes this correct
 * across a daylight-saving change, which does not move by a whole day of
 * milliseconds. Formatted back out through the fixed `UTC` zone rather than
 * read with local getters, for the same reason `naiveLocalIso` exists above.
 */
export function shiftDate(date: CalendarDate, deltaDays: number): CalendarDate {
  const { year, month, day } = parts(date)
  const shifted = new Date(Date.UTC(year, month, day + deltaDays))

  return formatInTimeZone(shifted, 'UTC', 'yyyy-MM-dd')
}

/**
 * The UTC instant range — half open, `[from, to)` — that covers one Shop-local
 * calendar day. Per ADR-0002, this is the only place a calendar day and an
 * instant meet: the API knows only instants, and the day view is what
 * converts between the two through the Shop's timezone rather than the
 * viewer's. The range spans 23 or 25 hours on the two days a year the Shop's
 * clocks change, and 24 every other day — never assumed to be exactly one day
 * of milliseconds.
 */
export function dayRangeUtc(date: CalendarDate, shopTimezone: string): { from: string; to: string } {
  const { year, month, day } = parts(date)

  const from = fromZonedTime(naiveLocalIso(year, month, day, 0, 0), shopTimezone)
  const to = fromZonedTime(naiveLocalIso(year, month, day + 1, 0, 0), shopTimezone)

  return { from: from.toISOString(), to: to.toISOString() }
}
