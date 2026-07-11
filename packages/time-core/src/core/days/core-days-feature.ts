import { assignCalendarAPIs } from '../../utils'
import { calendar_getProjectedDays } from './core-days-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'

/**
 * The Day entity feature. Owns Day-node construction and `getProjectedDays` — the
 * viewport's Day nodes a View's `build` consumes (the projection `layout` input).
 *
 * ponytail: day-node prototype methods land alongside the features that add them;
 * the grid + bucketing read is here now so Views render real events.
 */
export const coreDaysFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    assignCalendarAPIs('coreDaysFeature', calendar, {
      calendar_getProjectedDays: {
        fn: () => calendar_getProjectedDays(calendar),
        // Config options aren't reactive state; include them so a runtime
        // `setOptions` change (timeZone/weekStartsOn/locale) recomputes the grid.
        memoDeps: () => [
          calendar.store.state.events,
          calendar.store.state.currentPeriod,
          calendar.store.state.viewMode,
          calendar.options.timeZone,
          calendar.options.weekStartsOn,
          calendar.options.locale,
          calendar.options.resources, // availability-filtered occurrences feed days
        ],
      },
    })
  },
}
