import { Temporal } from '@js-temporal/polyfill'
import { DateCore } from '../date-core'
import type {
  Day,
  Event,
  EventDateTimeInput,
  Resource,
  ViewMode,
} from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'

/**
 * Concrete `DateCore` used as the calendar's date engine. It owns the store,
 * navigation, and day-grid math — all already implemented and tested — so the
 * core feature is a thin adapter that surfaces them on the instance.
 */
class CoreDateEngine extends DateCore {
  /** Expose the protected calendar-day grid. */
  listCalendarDays() {
    return this.getCalendarDays()
  }
}

/**
 * The always-on feature: store, navigation, week/day names, and a bare
 * `getDays()` grid. `eventsFeature` overrides `getDays()` to populate events.
 */
export const coreCalendarFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const engine = new CoreDateEngine(calendar.options)
    ;(calendar as { _dateCore?: CoreDateEngine })._dateCore = engine

    // The engine's parsed options already include defaults + range + every
    // extra option (events/resources/features) spread in by DateCore.
    calendar.store = engine.store
    calendar.options = engine.options as unknown as typeof calendar.options

    calendar.goToNextPeriod = () => engine.goToNextPeriod()
    calendar.goToPreviousPeriod = () => engine.goToPreviousPeriod()
    calendar.goToCurrentPeriod = () => engine.goToCurrentPeriod()
    calendar.goToSpecificPeriod = (date: EventDateTimeInput) =>
      engine.goToSpecificPeriod(date)
    calendar.canGoNextPeriod = () => engine.canGoNextPeriod()
    calendar.canGoPreviousPeriod = () => engine.canGoPreviousPeriod()
    calendar.changeViewMode = (viewMode: ViewMode) =>
      engine.changeViewMode(viewMode)
    calendar.getWeekStartsOn = () => engine.getWeekStartsOn()
    calendar.getDaysNames = (weekday?: 'long' | 'short') =>
      engine.getDaysNames(weekday)
    calendar._getCalendarDays = () => engine.listCalendarDays()

    calendar.getDays = () => buildDayShells<TResource, TEvent>(calendar)
  },
}

/** Bare day grid with empty event arrays; flags match the full builder. */
function buildDayShells<TResource extends Resource, TEvent extends Event<TResource>>(
  calendar: Calendar_Internal<any, TResource, TEvent>,
): Array<Day<TResource, TEvent>> {
  const { viewMode, currentPeriod } = calendar.store.state
  const currentMonthRange = Array.from(
    { length: viewMode.value },
    (_, i) => currentPeriod.add({ months: i }).month,
  )
  const today = Temporal.Now.plainDateISO()
  return calendar._getCalendarDays().map((date: Temporal.PlainDate) => ({
    date,
    isoDate: date.toString({ calendarName: 'never' }),
    events: [],
    allDayEvents: [],
    isToday: Temporal.PlainDate.compare(date, today) === 0,
    isInCurrentPeriod: currentMonthRange.includes(date.month),
  }))
}
