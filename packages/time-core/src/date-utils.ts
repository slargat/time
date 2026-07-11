import { Temporal } from '@js-temporal/polyfill'
import type { EventDateTimeInput } from './types'

/**
 * Minimal date helpers the kernel needs, kept self-contained (ADR 0007: deps are
 * only `@tanstack/store` + `@js-temporal/polyfill`).
 *
 * ponytail: only the bits rung-1 projection needs. The fuller `~/date` substrate
 * (startOf/endOf, locale week-info, multi-day split) is copied in as the features
 * that need it land — see `splitMultiDayEvents` (deferred) and `groupDaysBy`.
 */

/** Parse any event date input to a calendar date (drops the time component). */
export function toPlainDate(input: EventDateTimeInput): Temporal.PlainDate {
  return Temporal.PlainDate.from(toWallTimeString(input).slice(0, 10))
}

/** Inclusive list of dates from `start` to `end`. */
export function rangeOfDates(
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
): Array<Temporal.PlainDate> {
  const dates: Array<Temporal.PlainDate> = []
  let current = start
  while (Temporal.PlainDate.compare(current, end) <= 0) {
    dates.push(current)
    current = current.add({ days: 1 })
  }
  return dates
}

// ── flexible date/time parsing (salvaged from `~/date/parse`) ─────────────────

const rfc3339DateTimeOptionalTimeRegex =
  /^(?<fulldate>(?<year>\d{4})(?:-(?<month>0[1-9]|1[0-2])(?:-(?<day>0[1-9]|[12][0-9]|3[01]))))(?:(?:T| )(?<fulltime>(?<hour>[01][0-9]|2[0-3])(?::(?<minute>[0-5][0-9])(?::(?<second>[0-5][0-9])(?:\.(?<millisecond>\d+))?)?)?)?(?<timezone>Z|[+-](?:2[0-3]|[01][0-9]):?[0-5][0-9])?)?$/i

const dateOnlyRegex =
  /^(?<year>\d{4})(-(?<month>0[1-9]|1[0-2]))?(-(?<day>0[1-9]|[12][0-9]|3[01]))?(?<separator>T| )?(?<timezone>Z|[+-](?:2[0-3]|[01][0-9]):?[0-5][0-9])?$/i

const pad = (n: number): string => String(n).padStart(2, '0')

function epochToInstant(value: number): Temporal.Instant {
  // Epoch numbers are milliseconds, matching `new Date(number)` — no
  // integer-vs-fractional "is this seconds?" heuristic (a flagged trap in the
  // original). Pass seconds*1000 if you have seconds.
  if (!Number.isFinite(value) || value < -8.64e15 || value > 8.64e15) {
    throw new Error(`"${value}" is an invalid epoch (milliseconds) value`)
  }
  return Temporal.Instant.fromEpochMilliseconds(Math.round(value))
}

function instantToWallTime(
  instant: Temporal.Instant,
  timeZone: Temporal.TimeZoneLike,
): string {
  return instant
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'second' })
}

/**
 * Coerce any event date input to a zone-less wall-time string
 * (`YYYY-MM-DDTHH:mm:ss`) in `timeZone`.
 *
 * - Zone-less strings are taken **literally** — they already are wall time.
 * - **Absolute** inputs (a `Date`, an epoch `number`, or a string carrying a
 *   `Z`/offset) are real instants; they are converted **into** `timeZone`.
 *
 * This is the single canonical coercion. Normalization happens once at ingestion
 * (`normalizeEvent`) with the calendar's `options.timeZone`, so downstream the
 * collection only ever holds wall-time strings and this reduces to the literal
 * path (making the `timeZone` default irrelevant there). The `'UTC'` default is a
 * best-effort fallback for any stray absolute input not routed through ingestion;
 * `toPlainDate` and `toPlainDateTimeString` share it, so they can no longer
 * disagree (the old UTC-vs-local split).
 */
export function toWallTimeString(
  value: EventDateTimeInput,
  timeZone: Temporal.TimeZoneLike = 'UTC',
): string {
  if (value instanceof Date) {
    return instantToWallTime(
      Temporal.Instant.fromEpochMilliseconds(value.getTime()),
      timeZone,
    )
  }
  if (typeof value === 'number') {
    return instantToWallTime(epochToInstant(value), timeZone)
  }

  const match =
    rfc3339DateTimeOptionalTimeRegex.exec(value) ?? dateOnlyRegex.exec(value)
  if (!match?.groups) {
    throw new Error(
      `"${value}" is not a valid date/time string. Expected YYYY-MM-DD, YYYY-MM-DDTHH:mm, or YYYY-MM-DDTHH:mm:ss`,
    )
  }
  const g = match.groups
  const year = Number(g.year)
  const month = Number(g.month ?? '01')
  const day = Number(g.day ?? '01')
  const hour = Number(g.hour ?? '00')
  const minute = Number(g.minute ?? '00')
  const second = Number(g.second ?? '00')

  if (g.timezone) {
    // Offset-bearing string → a real instant. Rebuild a canonical RFC 3339 value
    // from the parsed parts (normalizing the offset to ±HH:MM) so `Instant.from`
    // accepts it, then convert into tz.
    let offset: string
    if (/^z$/i.test(g.timezone)) {
      offset = 'Z'
    } else {
      const digits = g.timezone.slice(1).replace(':', '')
      offset = `${g.timezone[0]}${digits.slice(0, 2)}:${digits.slice(2, 4) || '00'}`
    }
    const iso = `${pad(year)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${offset}`
    return instantToWallTime(Temporal.Instant.from(iso), timeZone)
  }

  // Zone-less wall time → literal.
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`
}

/**
 * Coerce a flexible date/time input to a `Temporal.PlainDateTime`-compatible ISO
 * string (`YYYY-MM-DDTHH:mm:ss`). Thin wrapper over {@link toWallTimeString};
 * post-ingestion callers only ever pass wall-time strings (literal path).
 */
export function toPlainDateTimeString(
  value: EventDateTimeInput,
  timeZone: Temporal.TimeZoneLike = 'UTC',
): string {
  return toWallTimeString(value, timeZone)
}
