import type { Event, Resource } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'

/**
 * On-demand event loading via the `fetchEvents` option. Tracks loaded ranges,
 * merges fetched events into eventsFeature's shared map, and toggles
 * `store.state.isPending`. Requires `eventsFeature`.
 */
export const lazyFetchFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const internals = calendar as unknown as {
      _eventMap: Map<string, TEvent>
      _normalizeEvent: (event: TEvent) => TEvent
      _bumpEvents: () => void
    }
    const fetchEvents = calendar.options.fetchEvents

    let loadedRanges: Array<{ start: string; end: string }> = []

    const isRangeLoaded = (start: string, end: string) => {
      for (const r of loadedRanges) {
        if (r.start <= start && r.end >= end) return true
      }
      return false
    }

    const markRangeLoaded = (start: string, end: string) => {
      loadedRanges.push({ start, end })
      loadedRanges.sort((a, b) => (a.start < b.start ? -1 : 1))
      const merged: Array<{ start: string; end: string }> = []
      for (const r of loadedRanges) {
        const last = merged[merged.length - 1]
        if (last && r.start <= last.end) {
          last.end = last.end > r.end ? last.end : r.end
        } else {
          merged.push({ ...r })
        }
      }
      loadedRanges = merged
    }

    const setPending = (isPending: boolean) =>
      calendar.store.setState((prev) => ({ ...prev, isPending }))

    const runFetch = async (start: string, end: string) => {
      if (!fetchEvents) return
      setPending(true)
      try {
        const fetched = await fetchEvents({ start, end })
        let hadNew = false
        for (const raw of fetched) {
          if (internals._eventMap.has(raw.id)) continue
          internals._eventMap.set(raw.id, internals._normalizeEvent(raw))
          hadNew = true
        }
        if (hadNew) internals._bumpEvents()
        setPending(false)
      } catch {
        loadedRanges = loadedRanges.filter(
          (r) => !(r.start === start && r.end === end),
        )
        setPending(false)
      }
    }

    calendar.fetchEventsForRange = async (start, end) => {
      if (!fetchEvents || isRangeLoaded(start, end)) return
      markRangeLoaded(start, end)
      await runFetch(start, end)
    }

    calendar.ensureRangeLoaded = () => {
      if (!fetchEvents) return
      const days = calendar._getCalendarDays()
      if (days.length === 0) return
      const rangeStart = days[0]!.toString({ calendarName: 'never' })
      const rangeEnd = days[days.length - 1]!
        .add({ days: 1 })
        .toString({ calendarName: 'never' })
      if (isRangeLoaded(rangeStart, rangeEnd)) return
      markRangeLoaded(rangeStart, rangeEnd)
      void runFetch(rangeStart, rangeEnd)
    }

    calendar.getLoadedRanges = () => loadedRanges

    // Self-drive on navigation so the hook needs no state subscription: when
    // the period/view changes, load the newly visible range.
    const navKey = () => {
      const { currentPeriod, viewMode } = calendar.store.state
      return `${currentPeriod.toString({ calendarName: 'never' })}|${viewMode.unit}|${viewMode.value}`
    }
    let prevNavKey = navKey()
    // @tanstack/store v0.11 subscribe() returns a Subscription ({ unsubscribe }),
    // not a bare function as in v0.8 — normalize to the () => void destroy expects.
    const subscription = calendar.store.subscribe(() => {
      const key = navKey()
      if (key === prevNavKey) return
      prevNavKey = key
      calendar.ensureRangeLoaded()
    })
    ;(calendar as { _lazyFetchUnsubscribe?: () => void })._lazyFetchUnsubscribe =
      () => subscription.unsubscribe()
  },

  destroy: (calendar) => {
    const unsubscribe = (
      calendar as { _lazyFetchUnsubscribe?: unknown }
    )._lazyFetchUnsubscribe
    if (typeof unsubscribe === 'function') unsubscribe()
  },
}
