import { normalizeEvents } from './normalize-event'
import type { Calendar_Internal } from '../../types/calendar'
import type { Event } from '../../types'

/** Static fns for the Event collection + entity (v9 `table_*` / `cell_*`). */

export function calendar_getEvents(
  calendar: Calendar_Internal<any, any, any>,
): Array<Event> {
  return (calendar.store.state.events as Array<Event> | undefined) ?? []
}

/**
 * Write the `events` atom in place (base atom, or an app-owned `options.atoms`
 * override). Used by the construction seed and the `setOptions` re-sync — neither
 * should fire `onEventsChange` (that channel is for propagating *internal*
 * mutations outward, not for reflecting the prop inward).
 */
export function writeEventsAtom(
  calendar: Calendar_Internal<any, any, any>,
  events: Array<Event>,
): void {
  const externalAtom = (
    calendar.options.atoms as Record<string, { set: (u: () => unknown) => void }> | undefined
  )?.events
  const target = externalAtom ?? calendar.baseAtoms.events!
  target.set(() => events)
}

/**
 * Replace the collection (normalizing to wall-time strings) via `onEventsChange`,
 * so uncontrolled calendars update their atom immediately and controlled ones
 * persist outward. The single write-side mutation point; `commit` and lazy-fetch
 * route through here.
 *
 * ponytail: plain array swap. Swap for a normalized map if write-heavy workloads
 * make per-op O(n) commits measurable.
 */
export function calendar_setEvents(
  calendar: Calendar_Internal<any, any, any>,
  events: Array<Event>,
): void {
  const timeZone = calendar.options.timeZone ?? 'UTC'
  const normalized = normalizeEvents(events, timeZone)
  calendar.options.onEventsChange?.(() => normalized)
}
