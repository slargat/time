import { Temporal } from '@js-temporal/polyfill'
import { toPlainDateTimeString } from '../../date-utils'
import type { Event, EventDateTimeInput, ViewMode } from '../../types'

/**
 * Time-grid event geometry, ported verbatim from `@tanstack/time`'s
 * `getEventProps` (the proven implementation). Pure + framework-agnostic: all
 * layout math lives here so the React adapter renders plain numbers (ADR 0007).
 *
 * Produces percent-based `top/height/left/width` for `week`/`day` views;
 * `left/width` split a span into columns when events overlap in time. Returns
 * just the base props (no `style`) for any other view.
 */

const MINUTES_IN_DAY = 24 * 60

const toZonedDateTime = (
  dateInput: EventDateTimeInput,
  timeZone: Temporal.TimeZoneLike,
): Temporal.ZonedDateTime =>
  Temporal.PlainDateTime.from(toPlainDateTimeString(dateInput)).toZonedDateTime(
    timeZone,
  )

const toMinutes = (date: Temporal.ZonedDateTime): number =>
  date.hour * 60 + date.minute

const toPercent = (minutes: number): number => (minutes / MINUTES_IN_DAY) * 100

const hasTimeOverlap = (
  aStart: Temporal.ZonedDateTime,
  aEnd: Temporal.ZonedDateTime,
  bStart: Temporal.ZonedDateTime,
  bEnd: Temporal.ZonedDateTime,
): boolean => {
  const compare = Temporal.ZonedDateTime.compare
  return compare(aStart, bEnd) < 0 && compare(aEnd, bStart) > 0
}

/** Percent-based absolute-position style for a positioned time-grid event. */
export interface EventStyle {
  top: string
  height: string
  left: string
  width: string
}

/** What `event.getEventProps()` returns; `style` is present only in week/day. */
export interface EventProps<TEvent extends Event = Event> {
  isSplitEvent: boolean
  overlappingEvents: Array<TEvent>
  start: string
  end: string
  style?: EventStyle
}

export function computeEventProps(
  allEvents: Array<Event>,
  event: Event,
  viewMode: ViewMode,
  timeZone: Temporal.TimeZoneLike,
): EventProps {
  const segmentStart = toZonedDateTime(event.start, timeZone)
  const segmentEnd = toZonedDateTime(event.end, timeZone)

  // The node is a per-day split segment when it carries `_originalStart/End`
  // (from `splitMultiDayEvents`); a whole single-day event does not. The
  // full span comes from those fields, falling back to the segment's own times.
  const isSplitEvent = event._originalStart != null
  const start = toPlainDateTimeString(event._originalStart ?? event.start)
  const end = toPlainDateTimeString(event._originalEnd ?? event.end)

  const overlappingEvents = allEvents.filter((e) => {
    if (e.id === event.id) return false
    const eStart = toZonedDateTime(e.start, timeZone)
    const eEnd = toZonedDateTime(e.end, timeZone)
    return hasTimeOverlap(segmentStart, segmentEnd, eStart, eEnd)
  })

  const baseProps = { isSplitEvent, overlappingEvents, start, end }

  const isTimeGridView =
    viewMode.unit === 'week' ||
    viewMode.unit === 'day' ||
    viewMode.unit === 'workWeek'
  if (!isTimeGridView) return baseProps

  const startMinutes = toMinutes(segmentStart)
  const endMinutes = toMinutes(segmentEnd)
  const durationMinutes = endMinutes - startMinutes

  const overlappingCount = overlappingEvents.length
  const columnCount = overlappingCount + 1

  // Column index: events starting earlier (id-tiebroken) sit to the left.
  const eventIndex =
    overlappingCount > 0
      ? overlappingEvents.filter((e) => {
          const eStart = toZonedDateTime(e.start, timeZone)
          const comparison = Temporal.ZonedDateTime.compare(eStart, segmentStart)
          if (comparison !== 0) return comparison < 0
          return e.id < event.id
        }).length
      : 0

  return {
    ...baseProps,
    style: {
      top: `${toPercent(startMinutes)}%`,
      height: `${toPercent(durationMinutes)}%`,
      left:
        overlappingCount > 0 ? `${(eventIndex * 100) / columnCount}%` : '0%',
      width: overlappingCount > 0 ? `${100 / columnCount}%` : '100%',
    },
  }
}
