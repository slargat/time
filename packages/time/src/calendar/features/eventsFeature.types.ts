import type { Event, Resource } from '../types'

/** API contributed by `eventsFeature` — the event data layer. */
export interface Calendar_Events<
  R extends Resource = Resource,
  E extends Event<R> = Event<R>,
> {
  /** Replace the entire event set. */
  setEvents(events: Array<E> | null): void
  /** Snapshot of all events currently held (including outside the visible range). */
  getEvents(): Array<E>
  /** Events occurring on a given ISO date (YYYY-MM-DD). */
  getEventsByDate(date: string): Array<E>
}
