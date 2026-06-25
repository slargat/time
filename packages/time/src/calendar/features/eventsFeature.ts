import { toPlainDateTimeString } from '~/date/parse'
import type { Day, Event, Resource } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type { CalendarFeature } from '../types/CalendarFeatures'

/**
 * The event data layer: holds events, exposes read/replace APIs, and enriches
 * `getDays()` with each day's events.
 *
 * ponytail: single-day, non-recurring placement only — recurrence expansion and
 * multi-day splitting are ported into this feature in Phase 4. Add when the full
 * grid is wired.
 */
export const eventsFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends import('../types/CalendarFeatures').CalendarFeatures,
    R extends Resource,
    E extends Event<R>,
  >(
    calendar: Calendar_Internal<TFeatures, R, E>,
  ) => {
    const eventMap = new Map<string, E>()
    for (const e of calendar.options.events ?? []) {
      eventMap.set(e.id, normalize(e))
    }

    calendar.setEvents = (events: Array<E> | null) => {
      eventMap.clear()
      for (const e of events ?? []) eventMap.set(e.id, normalize(e))
      bumpEvents(calendar)
    }

    calendar.getEvents = () => [...eventMap.values()]

    calendar.getEventsByDate = (date: string) =>
      [...eventMap.values()].filter((e) => dateKey(e) === date)

    const coreGetDays = calendar.getDays
    calendar.getDays = () => {
      const shells = coreGetDays()
      const byDate = new Map<string, Array<E>>()
      for (const e of eventMap.values()) {
        const k = dateKey(e)
        const bucket = byDate.get(k)
        if (bucket) bucket.push(e)
        else byDate.set(k, [e])
      }
      return shells.map(
        (day: Day<R, E>): Day<R, E> => {
          const all = byDate.get(day.isoDate) ?? []
          return {
            ...day,
            events: all.filter((e) => !e.allDay),
            allDayEvents: all.filter((e) => !!e.allDay),
          }
        },
      )
    }
  },
}

function normalize<E extends { start: unknown; end: unknown }>(event: E): E {
  return {
    ...event,
    start: toPlainDateTimeString(event.start as never),
    end: toPlainDateTimeString(event.end as never),
  }
}

function dateKey(event: { start: unknown }): string {
  const start = event.start as string
  return start.split('T')[0] ?? start
}

function bumpEvents(calendar: Calendar_Internal<any, any, any>): void {
  calendar.store.setState((prev) => ({
    ...prev,
    eventsVersion: prev.eventsVersion + 1,
  }))
}
