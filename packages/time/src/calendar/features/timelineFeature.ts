import {
  checkEventAvailability,
  getEventResourceIds,
  getUnavailabilityDetails,
  getUnavailableRangesPx,
} from '../availability'
import type {
  AvailabilityContext,
  MinuteRange,
  ResourceDayAvail,
} from '../availability'
import type { Event, Resource } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'

/**
 * Resources + availability. Reuses the shared `availability` module (the same
 * logic CalendarCore uses) and installs a `_checkEventAvailability` hook that
 * `eventsFeature` calls to drop recurring occurrences landing on unavailable
 * resource time. Requires `eventsFeature` (reads the shared event map).
 */
export const timelineFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const resourceDayAvailCache = new Map<string, ResourceDayAvail>()
    const mergedUnavailMinuteCache = new Map<string, Array<MinuteRange>>()
    const weekdayCache = new Map<string, number>()

    const internals = calendar as unknown as {
      _eventMap: Map<string, TEvent>
      _bumpEvents: () => void
      _checkEventAvailability?: (
        event: TEvent,
        start: string,
        end: string,
      ) => unknown
    }

    const ctx = (): AvailabilityContext<TResource, TEvent> => ({
      resources: calendar.options.resources ?? null,
      events: internals._eventMap.values(),
      resourceDayAvailCache,
      mergedUnavailMinuteCache,
      weekdayCache,
    })

    calendar.setResources = (resources: Array<TResource> | null) => {
      calendar.options.resources = resources
      resourceDayAvailCache.clear()
      mergedUnavailMinuteCache.clear()
      internals._bumpEvents()
    }

    calendar.getUnavailableRanges = (date, options) =>
      getUnavailableRangesPx(date, options, ctx())

    calendar.getUnavailabilityDetails = (date, startMinutes, endMinutes, options) =>
      getUnavailabilityDetails(
        date,
        startMinutes,
        endMinutes,
        options?.resourceIds,
        ctx(),
      )

    calendar.validateEventPlacement = (event) => {
      const placeholder = {
        id: event.id ?? '__validate_placement__',
        title: event.title,
        start: event.start,
        end: event.end,
        resources: event.resources,
        consumption: event.consumption,
      } as TEvent

      const conflict = checkEventAvailability(
        placeholder,
        event.start,
        event.end,
        ctx(),
        event.resources,
        event.consumption,
      )
      if (!conflict) return { blocked: false }

      const isCapacity = conflict.resourceDetails.some(
        (d) => d.reason === 'capacity',
      )
      const message = isCapacity
        ? `Cannot place "${event.title}" here — ${conflict.description}.`
        : `Cannot place "${event.title}" here — it falls inside an unavailable zone.`
      return { blocked: true, message }
    }

    calendar.getEventsByResource = () => {
      const map = new Map<TResource['id'], Array<TEvent>>()
      calendar.options.resources?.forEach((r) => map.set(r.id, []))

      const segments = calendar.getDays().flatMap((d) => d.events)
      const merged = new Map<string, TEvent>()
      for (const segment of segments) {
        if (!merged.has(segment.id)) {
          merged.set(segment.id, {
            ...segment,
            start: segment._originalStart ?? segment.start,
            end: segment._originalEnd ?? segment.end,
          } as TEvent)
        }
      }
      for (const event of merged.values()) {
        for (const rid of getEventResourceIds(event)) {
          map.get(rid)?.push(event)
        }
      }
      return map
    }

    // Hook eventsFeature reads (lazily) to filter recurring occurrences that
    // land on unavailable resource time.
    internals._checkEventAvailability = (event, start, end) =>
      checkEventAvailability(event, start, end, ctx())
  },
}
