import type { Event, Resource } from '../types'
import type {
  Calendar_Internal,
  DayNode,
  DayNode_Core,
  EventNode,
} from '../types/Calendar'
import type { CalendarFeatures } from '../types/CalendarFeatures'

/**
 * Wrap raw event/day data in the calendar's shared prototypes so each node
 * carries the methods contributed by registered features (e.g. resize's
 * `getResizeHandleProps`). The prototype is read at call time, so nodes built
 * during a render reflect every feature's `assign*Prototype`.
 */

export function makeEventNode<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  event: TEvent,
): EventNode<TFeatures, TResource, TEvent> {
  return Object.assign(Object.create(calendar._eventPrototype), event)
}

export function makeDayNode<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  data: DayNode_Core<TFeatures, TResource, TEvent>,
): DayNode<TFeatures, TResource, TEvent> {
  return Object.assign(Object.create(calendar._dayPrototype), data)
}
