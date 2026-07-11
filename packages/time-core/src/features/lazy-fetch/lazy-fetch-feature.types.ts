import type { CalendarFeatures } from '../../types/calendar-features'
import type { Event, Resource } from '../../types'

/** API contributed by `lazyFetchFeature` — on-demand event loading. */
declare module '../../types/calendar' {
  interface Calendar_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    lazyFetchFeature: {
      /** Fetch + merge events for an arbitrary range (no-op if already loaded). */
      fetchEventsForRange: (start: string, end: string) => Promise<void>
      /** Fetch the current view's range if not yet loaded (call from a view effect). */
      ensureRangeLoaded: () => void
      /** The ranges already fetched (merged). */
      getLoadedRanges: () => ReadonlyArray<{ start: string; end: string }>
    }
  }
}
