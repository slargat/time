import { useEffect, useState } from 'react'
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
 * Builds the instance once with {@link constructCalendar} and returns it stable
 * across renders — every method/node-prototype is created at construction, so
 * there are no per-render `useCallback`s. This hook does NOT subscribe to state;
 * read reactive state with bare `useStore` from `@tanstack/react-store`:
 *
 * @example
 * import { useStore } from '@tanstack/react-store'
 *
 * const calendar = useCalendar({ viewMode, events, features })
 * const viewMode = useStore(calendar.store, (s) => s.viewMode) // selective
 * const state = useStore(calendar.store)                       // everything
 */
export function useCalendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(
  options: CalendarOptions<TFeatures, TResource, TEvent>,
): Calendar<TFeatures, TResource, TEvent> {
  const [calendar] = useState(() => constructCalendar(options))

  // Tear down feature listeners (resize DOM handlers, lazyFetch subscription)
  // on unmount.
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

  // Initial range load (lazyFetchFeature then self-drives on navigation).
  useEffect(() => {
    ;(calendar as { ensureRangeLoaded?: () => void }).ensureRangeLoaded?.()
  }, [calendar])

  return calendar
}
