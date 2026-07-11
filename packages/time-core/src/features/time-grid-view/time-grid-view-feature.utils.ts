import { Temporal } from '@js-temporal/polyfill'
import { getTimeSlots } from '../timeline-view/get-time-slots'
import type { Calendar_Internal } from '../../types/calendar'
import type { TimeGridViewModel } from './time-grid-view-feature.types'

/**
 * Build the time-grid view model: the active grid's Day nodes (1 for `day`, 7
 * for `week`) over an hourly time axis. The grid days already cover the period
 * (see `calendar_getGridDays`), so no chunking/padding is needed.
 */
export function timeGridView_build(
  calendar: Calendar_Internal<any, any, any>,
): TimeGridViewModel<any, any, any> {
  const locale = calendar.options.locale ?? 'en-US'
  const timeZone = (calendar.options.timeZone ?? 'UTC') as Temporal.TimeZoneLike
  const now = Temporal.Now.plainDateTimeISO(timeZone)
  const nowTop = ((now.hour * 60 + now.minute) / (24 * 60)) * 100
  // DayNode<any,…> collapses to `never` at this all-any boundary; runtime nodes
  // carry the registered features' methods (same boundary as monthView_build).
  return {
    view: 'timeGrid',
    timeSlots: getTimeSlots(locale),
    days: calendar.getProjectedDays(),
    nowTop,
  } as TimeGridViewModel<any, any, any>
}
