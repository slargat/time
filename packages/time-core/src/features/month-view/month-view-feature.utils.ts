import type { Calendar_Internal } from '../../types/calendar'
import type { MonthViewModel, Week } from './month-view-feature.types'

/**
 * Build the month view model: the active grid's Day nodes chunked into week rows.
 *
 * The grid (`getProjectedDays`) is already padded to whole weeks aligned to
 * `weekStartsOn`, so chunking by 7 yields complete rows — no `groupDaysBy`
 * leading/trailing fill needed for the month grid.
 */
export function monthView_build(
  calendar: Calendar_Internal<any, any, any>,
): MonthViewModel<any, any, any> {
  // DayNode<any,…> collapses to `never` at this all-any boundary; the runtime
  // nodes carry the registered features' methods (same boundary as construct).
  const days = calendar.getProjectedDays() as Array<any>
  const weeks: Array<Week<any, any, any>> = []
  for (let i = 0; i < days.length; i += 7) {
    const row = days.slice(i, i + 7)
    weeks.push({ isoWeekStart: row[0]!.isoDate, days: row })
  }
  return {
    view: 'month',
    dayNames: monthView_dayNames(calendar),
    weeks,
  }
}

/** Localized weekday short names, ordered from the calendar's `weekStartsOn`. */
export function monthView_dayNames(
  calendar: Calendar_Internal<any, any, any>,
): Array<string> {
  const locale = calendar.options.locale ?? 'en-US'
  const weekStartsOn = calendar.options.weekStartsOn ?? 1
  const fmt = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    timeZone: 'UTC',
  })
  // 2024-01-01 is a Monday (ISO dayOfWeek 1); offset to weekStartsOn.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2024, 0, 1 + ((weekStartsOn - 1 + i) % 7)))),
  )
}
