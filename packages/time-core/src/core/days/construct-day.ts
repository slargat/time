import type {
  Calendar_Internal,
  DayNode,
  DayNode_Core,
} from '../../types/calendar'
import type { CalendarFeatures } from '../../types/calendar-features'
import type { Event, Resource } from '../../types'

/**
 * Wrap raw day data in the shared day prototype so each node carries the methods
 * contributed by registered features (v9 `constructRow` pattern).
 */
export function constructDay<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  data: DayNode_Core<TFeatures, TResource, TEvent>,
): DayNode<TFeatures, TResource, TEvent> {
  return Object.assign(Object.create(calendar._dayPrototype), data) as DayNode<
    TFeatures,
    TResource,
    TEvent
  >
}
