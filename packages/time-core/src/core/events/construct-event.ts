import type { Calendar_Internal, EventNode } from '../../types/calendar'
import type { CalendarFeatures } from '../../types/calendar-features'
import type { Event, Resource } from '../../types'

/**
 * Wrap a raw event in the shared event prototype so each node carries the
 * methods contributed by registered features (v9 `constructCell` pattern).
 */
export function constructEvent<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  event: TEvent,
): EventNode<TFeatures, TResource, TEvent> {
  return Object.assign(
    Object.create(calendar._eventPrototype),
    event,
  ) as EventNode<TFeatures, TResource, TEvent>
}
