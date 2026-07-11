import { assignCalendarAPIs } from '../../utils'
import { calendar_getProjectedEvents } from './core-projection-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'

/**
 * The always-on read-projection feature (v9 `coreRowModelsFeature`). Installs the
 * memoized stage-model chain cache and `getProjectedEvents`; the per-stage
 * `getPre*Model` dispatchers live in `core-projection-feature.utils.ts`.
 */
export const coreProjectionFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    calendar._projectionModels = {}
    assignCalendarAPIs('coreProjectionFeature', calendar, {
      calendar_getProjectedEvents: {
        fn: () => calendar_getProjectedEvents(calendar),
      },
    })
  },
}
