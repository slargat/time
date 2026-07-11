import type { EventProps } from './get-event-props'
import type { CalendarFeatures } from '../../types/calendar-features'
import type { DayNode } from '../../types/calendar'
import type { Event, Resource, TimeSlot } from '../../types'

/**
 * The week/day time-grid view model (Output Shapes: Day columns over a shared
 * TimeSlot axis). `days` is 1-wide for `day`, 7-wide for `week`. Event geometry
 * is read per-node via `event.getEventProps().style`, not precomputed here.
 */
export interface TimeGridViewModel<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  view: 'timeGrid'
  timeSlots: Array<TimeSlot>
  days: Array<DayNode<TFeatures, TResource, TEvent>>
  /**
   * Current-time indicator position, as a percent of the day height (0–100).
   * The renderer draws the "now" line in whichever column `isToday` is true.
   */
  nowTop: number
}

// Register the view model so `getView()` includes it in the discriminated union
// exactly when `timeGridViewFeature` is registered.
declare module '../../types/view-model' {
  interface ViewModel_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    timeGridViewFeature: TimeGridViewModel<TFeatures, TResource, TEvent>
  }
}

// Add the `getEventProps` node method to every event when the feature is on.
declare module '../../types/calendar' {
  interface EventNode_FeatureMap<
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    timeGridViewFeature: {
      /** Percent-based geometry + overlap info for the active view. */
      getEventProps: () => EventProps<TEvent>
    }
  }
}
