import { Temporal } from '@js-temporal/polyfill'
import { toPlainDate } from '../../date-utils'
import { calendar_getGridDays } from '../calendar/core-calendar-feature.utils'
import { constructEvent } from '../events/construct-event'
import { splitMultiDayEvents } from '../events/split-multi-day-events'
import { constructDay } from './construct-day'
import type { Calendar_Internal, DayNode, DayNode_Core } from '../../types/calendar'

/** Static fns for the Day entity (v9 `row_*`). Wired onto the day prototype as
 * node methods land; exported now for `static-functions.ts` and view builders. */

export function day_getEvents(day: DayNode_Core<any, any, any>) {
  return day.events
}

export function day_getAllDayEvents(day: DayNode_Core<any, any, any>) {
  return day.allDayEvents
}

/**
 * Build the viewport's Day nodes: bucket the projected occurrences by date onto
 * the active grid, splitting timed vs. all-day, wrapping each in its node
 * prototype. This is the read every View's `build` consumes (the `layout` input).
 *
 * Multi-day events are split per-day (segments carry `_originalStart/End`) so a
 * span renders on every day it covers, matching the original `getDays`.
 */
export function calendar_getProjectedDays(
  calendar: Calendar_Internal<any, any, any>,
): Array<DayNode<any, any, any>> {
  const events = calendar.getProjectedEvents()
  const timeZone = (calendar.options.timeZone ?? 'UTC') as Temporal.TimeZoneLike
  const byDate = new Map<string, Array<any>>()
  const place = (event: any) => {
    const key = toPlainDate(event.start).toString({ calendarName: 'never' })
    const bucket = byDate.get(key)
    if (bucket) bucket.push(event)
    else byDate.set(key, [event])
  }
  for (const event of events) {
    const isMultiDay =
      Temporal.PlainDate.compare(
        toPlainDate(event.start),
        toPlainDate(event.end),
      ) !== 0
    if (isMultiDay) splitMultiDayEvents(event, timeZone).forEach(place)
    else place(event)
  }

  // ponytail: `isToday` is snapshotted when the day model is (re)built; it won't
  // flip at midnight on an idle calendar until the next state change rebuilds it.
  // A midnight timer to force that is over-engineering for v1 — add one only if a
  // long-lived idle calendar showing a stale "today" is a real reported problem.
  const today = Temporal.Now.plainDateISO()
  const { currentPeriod, viewMode } = calendar.store.state
  const periodMonths = Array.from(
    { length: Math.max(viewMode.value, 1) },
    (_, i) => currentPeriod.add({ months: i }).month,
  )

  return calendar_getGridDays(calendar).map((date) => {
    const isoDate = date.toString({ calendarName: 'never' })
    const timed: Array<any> = []
    const allDay: Array<any> = []
    for (const event of byDate.get(isoDate) ?? []) {
      const node = constructEvent(calendar, event)
      ;(event.allDay ? allDay : timed).push(node)
    }
    // The all-`any` boundary collapses EventNode<any,…> to `never`; concrete call
    // sites resolve node types correctly (same boundary as timelineView_build).
    return constructDay(calendar, {
      date,
      isoDate,
      events: timed,
      allDayEvents: allDay,
      isToday: Temporal.PlainDate.compare(date, today) === 0,
      isInCurrentPeriod: periodMonths.includes(date.month),
    } as any)
  })
}
