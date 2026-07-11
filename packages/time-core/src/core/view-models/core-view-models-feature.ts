import { assignCalendarAPIs } from '../../utils'
import { calendar_getView } from './core-view-models-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'

/**
 * The always-on view-model dispatch feature (v9 `coreRowModelsFeature`).
 * Installs `getView()`, memoized on the inputs that change the active view model.
 */
export const coreViewModelsFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    assignCalendarAPIs('coreViewModelsFeature', calendar, {
      calendar_getView: {
        fn: () => calendar_getView(calendar),
        // Config options aren't reactive state; include the ones that shape a view
        // (timeZone/locale/resources/weekStartsOn) so `setOptions` recomputes it.
        memoDeps: () => [
          calendar.store.state.viewMode,
          calendar.store.state.currentPeriod,
          calendar.store.state.events,
          calendar.options.timeZone,
          calendar.options.locale,
          calendar.options.resources,
          calendar.options.weekStartsOn,
        ],
      },
    })
  },
}
