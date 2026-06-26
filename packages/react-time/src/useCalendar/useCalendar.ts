import { useEffect, useState } from 'react'
import { useStore } from '@tanstack/react-store'
import { constructCalendar } from '@tanstack/time'
import type {
  Calendar,
  CalendarFeatures,
  CalendarOptions,
  Event,
  Resource,
} from '@tanstack/time'

export type { ResizeState } from '@tanstack/time'

/**
 * React binding for the feature-composed calendar.
 *
 * The instance is built once with {@link constructCalendar} and is stable across
 * renders — every method (and node prototype) is created at construction, so
 * there are no per-render `useCallback`s. Reactivity comes from subscribing to
 * the calendar's store; mutations call `store.setState`, which re-renders.
 *
 * @example
 * const calendar = useCalendar({
 *   viewMode: { value: 1, unit: 'month' },
 *   events,
 *   features: { eventsFeature, eventCrudFeature, resizeFeature, historyFeature },
 * })
 */
export function useCalendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(
  options: CalendarOptions<TFeatures, TResource, TEvent>,
): Calendar<TFeatures, TResource, TEvent> {
  const [calendar] = useState(() => constructCalendar(options))

  // Re-render on any state change. The instance is stable.
  const state = useStore(calendar.store)

  // Tear down feature listeners (e.g. resize DOM handlers) on unmount.
  useEffect(() => () => calendar.destroy(), [calendar])

  // Keep the resize controller's options in sync (when resizeFeature is on).
  const resizeOptions = options.resize
  useEffect(() => {
    const controller = (
      calendar as {
        resizeController?: {
          setOptions: (o: NonNullable<typeof resizeOptions>) => void
        }
      }
    ).resizeController
    if (controller && resizeOptions) controller.setOptions(resizeOptions)
  }, [calendar, resizeOptions])

  // Load the visible range on period/view change (when lazyFetchFeature is on).
  useEffect(() => {
    ;(calendar as { ensureRangeLoaded?: () => void }).ensureRangeLoaded?.()
  }, [calendar, state.currentPeriod, state.viewMode])

  return calendar
}
