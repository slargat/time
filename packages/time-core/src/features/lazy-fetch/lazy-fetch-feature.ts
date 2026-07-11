import { assignCalendarAPIs } from '../../utils'
import {
  calendar_ensureRangeLoaded,
  calendar_fetchEventsForRange,
  calendar_getLoadedRanges,
  createLazyFetchState,
  subscribeNavigation,
} from './lazy-fetch-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'
import './lazy-fetch-feature.types'

/**
 * On-demand event loading via the `fetchEvents` option (opt-in). Tracks loaded
 * ranges, merges fetched events into the collection (via `setEvents`, one
 * `events`-slice replacement), toggles `isPending`, and self-drives on navigation
 * so the adapter only needs to call `ensureRangeLoaded()` once.
 */
export const lazyFetchFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    calendar._lazyFetch = createLazyFetchState()
    assignCalendarAPIs('lazyFetchFeature', calendar, {
      calendar_fetchEventsForRange: {
        fn: (start: string, end: string) =>
          calendar_fetchEventsForRange(calendar, start, end),
      },
      calendar_ensureRangeLoaded: {
        fn: () => calendar_ensureRangeLoaded(calendar),
      },
      calendar_getLoadedRanges: { fn: () => calendar_getLoadedRanges(calendar) },
    })
    subscribeNavigation(calendar)
  },

  destroy: (calendar) => {
    const unsubscribe = (calendar._lazyFetch as { unsubscribe?: () => void })
      .unsubscribe
    if (typeof unsubscribe === 'function') unsubscribe()
  },
}
