import { Temporal } from '@js-temporal/polyfill'
import { rangeOfDates, toPlainDate } from '../../date-utils'
import type { Calendar_Internal } from '../../types/calendar'
import type { ProjectionContext } from '../../pipeline/stages'
import type { EventDateTimeInput, ViewMode } from '../../types'

/**
 * Static fns behind the Calendar singleton's navigation APIs (v9 `table_*`).
 * State writes go through the writable `baseAtoms`, not the read-only `store`.
 */

const UNIT_TO_TEMPORAL: Record<ViewMode['unit'], 'months' | 'weeks' | 'days'> =
  {
    month: 'months',
    week: 'weeks',
    workWeek: 'weeks',
    day: 'days',
    timeline: 'days',
    agenda: 'days',
  }

function shift(
  calendar: Calendar_Internal<any, any, any>,
  direction: 1 | -1,
): void {
  const viewMode = calendar.store.state.viewMode
  calendar.options.onCurrentPeriodChange?.((old: Temporal.PlainDate) =>
    old.add({ [UNIT_TO_TEMPORAL[viewMode.unit]]: direction * viewMode.value }),
  )
}

export function calendar_changeViewMode(
  calendar: Calendar_Internal<any, any, any>,
  viewMode: ViewMode,
): void {
  calendar.options.onViewModeChange?.(viewMode)
}

export function calendar_goToNextPeriod(
  calendar: Calendar_Internal<any, any, any>,
): void {
  shift(calendar, 1)
}

export function calendar_goToPreviousPeriod(
  calendar: Calendar_Internal<any, any, any>,
): void {
  shift(calendar, -1)
}

export function calendar_goToCurrentPeriod(
  calendar: Calendar_Internal<any, any, any>,
): void {
  calendar.options.onCurrentPeriodChange?.(Temporal.Now.plainDateISO())
}

export function calendar_goToSpecificPeriod(
  calendar: Calendar_Internal<any, any, any>,
  date: EventDateTimeInput,
): void {
  const iso =
    typeof date === 'string'
      ? date.slice(0, 10)
      : new Date(date).toISOString().slice(0, 10)
  calendar.options.onCurrentPeriodChange?.(Temporal.PlainDate.from(iso))
}

// ── viewport day grid (drives the read projection's window) ───────────────────

/**
 * The days the active viewport shows. For `month`, the 6×7-style grid padded to
 * whole weeks so the View can chunk by 7; other units return the plain period
 * range.
 *
 * ponytail: `weekStartsOn` defaults to 1 (Mon). Locale-derived defaults arrive
 * with `getWeekInfo` when the week/workWeek views land.
 */
export function calendar_getGridDays(
  calendar: Calendar_Internal<any, any, any>,
): Array<Temporal.PlainDate> {
  const { currentPeriod, viewMode } = calendar.store.state
  const weekStartsOn = calendar.options.weekStartsOn ?? 1
  const span = Math.max(viewMode.value, 1)

  if (viewMode.unit === 'month') {
    const first = currentPeriod.with({ day: 1 })
    const lastMonth = first.add({ months: span - 1 })
    const last = lastMonth.with({ day: lastMonth.daysInMonth })
    const leading = (first.dayOfWeek - weekStartsOn + 7) % 7
    const weekEndDow = ((weekStartsOn + 5) % 7) + 1
    const trailing = (weekEndDow - last.dayOfWeek + 7) % 7
    return rangeOfDates(
      first.subtract({ days: leading }),
      last.add({ days: trailing }),
    )
  }

  // workWeek: Mon–Fri of currentPeriod's ISO week. Work weeks are Mon–Fri by
  // convention, so this aligns to Monday regardless of `weekStartsOn` and span.
  if (viewMode.unit === 'workWeek') {
    const monday = currentPeriod.subtract({ days: currentPeriod.dayOfWeek - 1 })
    return rangeOfDates(monday, monday.add({ days: 4 }))
  }

  // week: align the window to `weekStartsOn` so any date in the week shows the
  // same 7-day period (mirrors workWeek's Monday snap). day: no alignment.
  const unitDays = viewMode.unit === 'week' ? 7 : 1
  const start =
    viewMode.unit === 'week'
      ? currentPeriod.subtract({
          days: (currentPeriod.dayOfWeek - weekStartsOn + 7) % 7,
        })
      : currentPeriod
  return rangeOfDates(start, start.add({ days: unitDays * span - 1 }))
}

/** Inclusive-start / exclusive-end ISO window the projection covers. */
export function calendar_getViewportWindow(
  calendar: Calendar_Internal<any, any, any>,
): { start: string; end: string } {
  const days = calendar_getGridDays(calendar)
  const opts = { calendarName: 'never' } as const
  return {
    start: days[0]!.toString(opts),
    end: days[days.length - 1]!.add({ days: 1 }).toString(opts),
  }
}

/**
 * The `clip` projection stage (owned by `coreCalendarFeature`): drop occurrences
 * whose date falls outside the viewport window. ISO date strings compare
 * lexically, so plain string comparison is correct.
 *
 * ponytail: clips by start date only. Trimming multi-day spans to the window edge
 * arrives with `splitMultiDayEvents`.
 */
export function calendar_clipToWindow(ctx: ProjectionContext): ProjectionContext {
  const { start, end } = ctx.window
  return {
    ...ctx,
    events: ctx.events.filter((event) => {
      const date = toPlainDate(event.start).toString({ calendarName: 'never' })
      return date >= start && date < end
    }),
  }
}
