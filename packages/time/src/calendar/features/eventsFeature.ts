import { Temporal } from '@js-temporal/polyfill'
import { expandRecurringEvent } from '../expandRecurringEvent'
import { splitMultiDayEvents } from '../splitMultiDayEvents'
import { generateDateRange } from '../generateDateRange'
import { getEventProps as computeEventProps } from '../getEventProps'
import { getSegmentInfo } from '../getResizeProps'
import { groupDaysBy as groupDaysByImpl } from '../groupDaysBy'
import { getTimeSlots as getTimeSlotsImpl } from '../getTimeSlots'
import type { Day, Event, Resource } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'
import type { EventProps } from './eventsFeature.types'
import { toPlainDateTimeString } from '~/date/parse'

/**
 * The event data + derivation layer: holds events, builds the per-day event map
 * (recurrence expansion + multi-day splitting + memoization), and exposes the
 * read/derive APIs. Mutating features (crud, resize) reach the shared map via
 * the `_eventMap` / `_normalizeEvent` / `_bumpEvents` internals it installs.
 *
 * ponytail: resource-availability filtering of occurrences is layered on by the
 * timeline/availability feature — this feature places every occurrence. Add the
 * conflict gate when that feature lands.
 */
export const eventsFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const eventMap = new Map<string, TEvent>()
    let mapVersion = 0
    let cacheVersion = -1
    const eventMapCache = new Map<string, Map<string, Array<TEvent>>>()

    // Both are always resolved at runtime by DateCore's defaults; the option
    // types just keep them optional.
    const timeZone = calendar.options.timeZone ?? 'UTC'
    const locale = calendar.options.locale!

    const normalizeRecurrence = (
      rule: NonNullable<TEvent['recurrence']>,
    ): NonNullable<TEvent['recurrence']> => ({
      ...rule,
      exDates: rule.exDates?.map((value) =>
        typeof value === 'string' && !value.includes('T')
          ? value
          : toPlainDateTimeString(value),
      ),
      overrides: rule.overrides?.map((override) => ({
        ...override,
        originalStart:
          typeof override.originalStart === 'string' &&
          !override.originalStart.includes('T')
            ? override.originalStart
            : toPlainDateTimeString(override.originalStart),
        ...(override.start != null
          ? { start: toPlainDateTimeString(override.start) }
          : {}),
        ...(override.end != null
          ? { end: toPlainDateTimeString(override.end) }
          : {}),
      })),
    })

    const normalizeEvent = (event: TEvent): TEvent => {
      const recurrence = event.recurrence
      return {
        ...event,
        start: toPlainDateTimeString(event.start),
        end: toPlainDateTimeString(event.end),
        ...(recurrence ? { recurrence: normalizeRecurrence(recurrence) } : {}),
      }
    }

    const indexEvents = (events: Iterable<TEvent>) => {
      eventMap.clear()
      for (const event of events) eventMap.set(event.id, normalizeEvent(event))
    }

    const bumpEvents = () => {
      mapVersion++
      calendar.store.setState((prev) => ({
        ...prev,
        eventsVersion: prev.eventsVersion + 1,
      }))
    }

    const placeEvent = (map: Map<string, Array<TEvent>>, ev: TEvent) => {
      const startDt = Temporal.PlainDateTime.from(ev.start as string)
      const endDt = Temporal.PlainDateTime.from(ev.end as string)
      const startDate = startDt.toPlainDate()
      const endDate = endDt.toPlainDate()

      if (Temporal.PlainDate.compare(startDate, endDate) !== 0) {
        for (const segment of splitMultiDayEvents<TResource, TEvent>(ev, timeZone)) {
          const key = Temporal.PlainDateTime.from(
            toPlainDateTimeString(segment.start),
          )
            .toPlainDate()
            .toString({ calendarName: 'never' })
          const bucket = map.get(key)
          if (bucket) bucket.push(segment)
          else map.set(key, [segment])
        }
      } else {
        const key = startDate.toString({ calendarName: 'never' })
        const bucket = map.get(key)
        if (bucket) bucket.push(ev)
        else map.set(key, [ev])
      }
    }

    const getEventMap = (window?: { start: string; end: string }) => {
      let windowStart: string | null
      let windowEnd: string | null
      if (window) {
        windowStart = window.start
        windowEnd = window.end
      } else {
        const days = calendar._getCalendarDays()
        windowStart = days.length
          ? days[0]!.toString({ calendarName: 'never' })
          : null
        windowEnd = days.length
          ? days[days.length - 1]!
              .add({ days: 1 })
              .toString({ calendarName: 'never' })
          : null
      }

      if (cacheVersion !== mapVersion) {
        eventMapCache.clear()
        cacheVersion = mapVersion
      }
      const cacheKey = `${windowStart ?? ''}|${windowEnd ?? ''}`
      const cached = eventMapCache.get(cacheKey)
      if (cached) return cached

      const map = new Map<string, Array<TEvent>>()
      for (const event of eventMap.values()) {
        if (event.recurrence && windowStart && windowEnd) {
          for (const occ of expandRecurringEvent<TResource, TEvent>(
            event,
            windowStart,
            windowEnd,
          )) {
            placeEvent(map, occ)
          }
          continue
        }
        placeEvent(map, event)
      }

      eventMapCache.set(cacheKey, map)
      return map
    }

    const buildDays = (
      days: Array<Temporal.PlainDate>,
      window?: { start: string; end: string },
    ): Array<Day<TResource, TEvent>> => {
      const map = getEventMap(window)
      const { viewMode, currentPeriod } = calendar.store.state
      const currentMonthRange = Array.from(
        { length: viewMode.value },
        (_, i) => currentPeriod.add({ months: i }).month,
      )
      const today = Temporal.Now.plainDateISO()
      return days.map((day) => {
        const isoDate = day.toString({ calendarName: 'never' })
        const dailyEvents = map.get(isoDate) ?? []
        const events: Array<TEvent> = []
        const allDayEvents: Array<TEvent> = []
        for (const ev of dailyEvents) {
          if (ev.allDay) allDayEvents.push(ev)
          else events.push(ev)
        }
        return {
          date: day,
          isoDate,
          events,
          allDayEvents,
          isToday: Temporal.PlainDate.compare(day, today) === 0,
          isInCurrentPeriod: currentMonthRange.includes(day.month),
        }
      })
    }

    indexEvents(calendar.options.events ?? [])

    // ── public API ──────────────────────────────────────────────────────────
    calendar.setEvents = (events: Array<TEvent> | null) => {
      indexEvents(events ?? [])
      bumpEvents()
    }

    calendar.getEvents = () => [...eventMap.values()]

    calendar.getDays = () => buildDays(calendar._getCalendarDays())

    calendar.getDaysInRange = (start: string, end: string) => {
      const days = generateDateRange(start, end)
      const windowEnd = Temporal.PlainDate.from(end)
        .add({ days: 1 })
        .toString({ calendarName: 'never' })
      return buildDays(days, { start, end: windowEnd })
    }

    calendar.getEventsByDate = (date: string) => {
      const target = Temporal.PlainDate.from(date).toString({
        calendarName: 'never',
      })
      const windowEnd = Temporal.PlainDate.from(target)
        .add({ days: 1 })
        .toString({ calendarName: 'never' })
      return [...(getEventMap({ start: target, end: windowEnd }).get(target) ?? [])]
    }

    calendar.getAllDayEventsByDate = (date: string) =>
      calendar.getEventsByDate(date).filter((e) => !!e.allDay)

    calendar.getMasterEvent = (event: TEvent) =>
      event._recurringMasterId
        ? (eventMap.get(event._recurringMasterId) ?? event)
        : event

    calendar.getEventSegmentInfo = (event: TEvent) =>
      getSegmentInfo({
        start: toPlainDateTimeString(event.start),
        end: toPlainDateTimeString(event.end),
        ...(event._originalStart != null
          ? { _originalStart: event._originalStart }
          : {}),
        ...(event._originalEnd != null
          ? { _originalEnd: event._originalEnd }
          : {}),
      })

    calendar.getEventProps = (event: TEvent) =>
      computeEventProps(
        getEventMap() as Map<string, Array<Event>>,
        event,
        calendar.store.state,
        { timeZone },
      ) as EventProps<TEvent>

    calendar.groupDaysBy = ({
      days,
      unit,
      fillMissingDays = true,
    }: {
      days: Array<Day<TResource, TEvent> | null>
      unit: 'week' | 'workWeek'
      fillMissingDays?: boolean
    }) =>
      groupDaysByImpl<TResource, TEvent>({
        days,
        unit,
        fillMissingDays,
        weekStartsOn: calendar.getWeekStartsOn(),
        locale,
      })

    calendar.getTimeSlots = (options?: {
      startHour?: number
      endHour?: number
      interval?: number
    }) => getTimeSlotsImpl(locale, options)

    // ── internals shared with mutating features ─────────────────────────────
    const internals = calendar as unknown as {
      _eventMap: Map<string, TEvent>
      _normalizeEvent: (event: TEvent) => TEvent
      _getEventMap: (window?: { start: string; end: string }) => Map<
        string,
        Array<TEvent>
      >
      _bumpEvents: () => void
    }
    internals._eventMap = eventMap
    internals._normalizeEvent = normalizeEvent
    internals._getEventMap = getEventMap
    internals._bumpEvents = bumpEvents
  },
}
