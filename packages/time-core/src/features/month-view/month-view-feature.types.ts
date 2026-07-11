import type { CalendarFeatures } from '../../types/calendar-features'
import type { DayNode } from '../../types/calendar'
import type { Event, Resource } from '../../types'

/** A week row in the month grid. `days` is 7-wide; leading/trailing nulls pad it. */
export interface Week<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  isoWeekStart: string
  days: Array<DayNode<TFeatures, TResource, TEvent> | null>
}

/** The month view's view model (Output Shapes: Week → Day → Event). */
export interface MonthViewModel<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  view: 'month'
  dayNames: Array<string>
  weeks: Array<Week<TFeatures, TResource, TEvent>>
}

// Register this view's model so `getView()` includes it in the discriminated
// union exactly when `monthViewFeature` is registered.
declare module '../../types/view-model' {
  interface ViewModel_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    monthViewFeature: MonthViewModel<TFeatures, TResource, TEvent>
  }
}
