import type { CalendarFeatures } from '../../types/calendar-features'
import type { EventNode } from '../../types/calendar'
import type { Event, Resource, TimeSlot } from '../../types'

/** One resource's lane: its events laid out along the time axis. */
export interface TimelineLane<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  resource: TResource
  events: Array<EventNode<TFeatures, TResource, TEvent>>
}

/**
 * The timeline view's view model (Output Shapes: Lane → Event, over a shared
 * TimeSlot axis). Lane/TimeSlot are view-model outputs, not feature-extensible
 * entities (ADR 0007).
 */
export interface TimelineViewModel<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  view: 'timeline'
  timeSlots: Array<TimeSlot>
  lanes: Array<TimelineLane<TFeatures, TResource, TEvent>>
}

// Register this view's model so `getView()` includes it in the discriminated
// union exactly when `timelineViewFeature` is registered.
declare module '../../types/view-model' {
  interface ViewModel_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    timelineViewFeature: TimelineViewModel<TFeatures, TResource, TEvent>
  }
}
