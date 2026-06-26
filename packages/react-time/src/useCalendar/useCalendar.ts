import { useEffect, useMemo, useState } from 'react'
import { shallow, useStore } from '@tanstack/react-store'
import { constructCalendar } from '@tanstack/time'
import type { ReactNode } from 'react'
import type {
  Calendar,
  CalendarFeatures,
  CalendarOptions,
  CalendarStore,
  Event,
  Resource,
} from '@tanstack/time'

export type { ResizeState } from '@tanstack/time'

/** A selector over the calendar's reactive state. */
export type CalendarStateSelector<TSelected> = (state: CalendarStore) => TSelected

/**
 * Render-prop that subscribes to a slice of calendar state, for targeted
 * re-renders deeper in the tree. Without a selector, children receive the whole
 * state.
 */
export interface CalendarSubscribe {
  (props: {
    selector?: undefined
    children: ((state: CalendarStore) => ReactNode) | ReactNode
  }): ReactNode
  <TSelected>(props: {
    selector: CalendarStateSelector<TSelected>
    children: ((state: TSelected) => ReactNode) | ReactNode
  }): ReactNode
}

type CalendarStoreType = Calendar<
  CalendarFeatures,
  Resource,
  Event<Resource>
>['store']

/** Module-level so the hook lives in a real component (rules-of-hooks). */
function CalendarSubscribeComponent(props: {
  store: CalendarStoreType
  selector?: CalendarStateSelector<unknown>
  children: ((state: unknown) => ReactNode) | ReactNode
}): ReactNode {
  const selected = useStore(props.store, props.selector, { equal: shallow })
  return typeof props.children === 'function'
    ? props.children(selected)
    : props.children
}

/** The calendar instance plus React-only `state` and `Subscribe`. */
export type ReactCalendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
  TSelected = CalendarStore,
> = Calendar<TFeatures, TResource, TEvent> & {
  /**
   * Selected reactive state. Equals the whole {@link CalendarStore} unless a
   * selector was passed to {@link useCalendar}.
   */
  readonly state: Readonly<TSelected>
  /** Subscribe to a slice of state lower in the tree (see {@link CalendarSubscribe}). */
  Subscribe: CalendarSubscribe
}

/**
 * React binding for the feature-composed calendar.
 *
 * The instance is built once and stable; every method/node-prototype is created
 * at construction (no per-render `useCallback`s). The component re-renders when
 * the selected state changes — pass `selector` to subscribe to a slice, or omit
 * it to subscribe to everything. The selected value is exposed as
 * `calendar.state`. For targeted subscriptions deeper in the tree use
 * `<calendar.Subscribe selector={…}>`; for a bare escape hatch use
 * `useStore(calendar.store, selector)` from `@tanstack/react-store`.
 *
 * @example
 * const calendar = useCalendar({ viewMode, events, features })
 * calendar.state.viewMode
 *
 * // selective at the hook:
 * const calendar = useCalendar(options, (s) => ({ viewMode: s.viewMode }))
 *
 * // selective deeper in the tree:
 * <calendar.Subscribe selector={(s) => s.isPending}>
 *   {(isPending) => (isPending ? <Spinner /> : null)}
 * </calendar.Subscribe>
 */
export function useCalendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
  TSelected = CalendarStore,
>(
  options: CalendarOptions<TFeatures, TResource, TEvent>,
  selector?: CalendarStateSelector<TSelected>,
): ReactCalendar<TFeatures, TResource, TEvent, TSelected> {
  const [calendar] = useState(() => {
    const instance = constructCalendar(
      options,
    ) as unknown as ReactCalendar<TFeatures, TResource, TEvent, TSelected>

    instance.Subscribe = ((props: {
      selector?: CalendarStateSelector<unknown>
      children: ((state: unknown) => ReactNode) | ReactNode
    }) =>
      CalendarSubscribeComponent({
        ...props,
        store: instance.store,
      })) as CalendarSubscribe

    return instance
  })

  // Tear down feature listeners on unmount.
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

  const state = useStore(calendar.store, selector, { equal: shallow })

  return useMemo(
    () =>
      ({ ...calendar, state }) as ReactCalendar<
        TFeatures,
        TResource,
        TEvent,
        TSelected
      >,
    [calendar, state],
  )
}
