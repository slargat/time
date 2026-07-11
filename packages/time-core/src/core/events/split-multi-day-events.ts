import { Temporal } from '@js-temporal/polyfill'
import { toPlainDateTimeString } from '../../date-utils'
import type { Event, Resource } from '../../types'

/**
 * Split a multi-day event into one per-day segment, each carrying
 * `_originalStart`/`_originalEnd` so the source span is recoverable. Salvaged
 * from `@tanstack/time`'s `splitMultiDayEvents` (reimplemented on Temporal
 * `startOfDay` to avoid pulling in the `startOf`/`endOf` helpers).
 *
 * Caller guards: only call for events whose start/end fall on different dates.
 */
export function splitMultiDayEvents<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(event: TEvent, timeZone: Temporal.TimeZoneLike): Array<TEvent> {
  const startZdt = Temporal.PlainDateTime.from(
    toPlainDateTimeString(event.start),
  ).toZonedDateTime(timeZone)
  const endZdt = Temporal.PlainDateTime.from(
    toPlainDateTimeString(event.end),
  ).toZonedDateTime(timeZone)

  const segments: Array<TEvent> = []
  let cursor = startZdt
  while (Temporal.ZonedDateTime.compare(cursor, endZdt) < 0) {
    const startOfDay = cursor.startOfDay()
    const nextDay = startOfDay.add({ days: 1 })
    const segStart =
      Temporal.ZonedDateTime.compare(cursor, startZdt) === 0
        ? startZdt
        : startOfDay
    const continuesPast = Temporal.ZonedDateTime.compare(endZdt, nextDay) >= 0
    const segEnd = continuesPast ? nextDay.subtract({ seconds: 1 }) : endZdt

    segments.push({
      ...event,
      start: segStart.toPlainDateTime().toString({ smallestUnit: 'second' }),
      end: segEnd.toPlainDateTime().toString({ smallestUnit: 'second' }),
      _originalStart: toPlainDateTimeString(event.start),
      _originalEnd: toPlainDateTimeString(event.end),
    } as TEvent)

    cursor = nextDay
  }
  return segments
}
