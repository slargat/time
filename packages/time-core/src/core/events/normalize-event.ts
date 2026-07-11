import { toWallTimeString } from '../../date-utils'
import type { Temporal } from '@js-temporal/polyfill'
import type { Event } from '../../types'

/**
 * Normalize an event's `start`/`end` to zone-less wall-time strings in
 * `timeZone` (ADR 0007 / grilling decision 2: coerce absolute inputs — `Date`,
 * epoch `number`, `Z`/offset strings — into the calendar's zone **once, at
 * ingestion**). Downstream the collection holds only wall-time strings, so every
 * date helper reduces to the literal path and the UTC-vs-local coercion split
 * can't occur.
 *
 * A later `timeZone` change does **not** retro-convert already-stored wall-times
 * (an event kept at 09:00 stays at 09:00); the zone only governs how *new*
 * absolute inputs are interpreted.
 */
export function normalizeEvent<TEvent extends Event>(
  event: TEvent,
  timeZone: Temporal.TimeZoneLike,
): TEvent {
  return {
    ...event,
    start: toWallTimeString(event.start, timeZone),
    end: toWallTimeString(event.end, timeZone),
  }
}

/** Normalize a collection (see {@link normalizeEvent}). */
export function normalizeEvents<TEvent extends Event>(
  events: ReadonlyArray<TEvent>,
  timeZone: Temporal.TimeZoneLike,
): Array<TEvent> {
  return events.map((event) => normalizeEvent(event, timeZone))
}
