import type { AvailabilityConflict, Event, Resource } from '../../types'
import type { CalendarFeatures } from '../../types/calendar-features'

/** API contributed by `availabilityFeature`. */
declare module '../../types/calendar' {
  interface Calendar_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    availabilityFeature: {
      /** Whether a placement violates resource availability/capacity. */
      validateEventPlacement: (input: {
        id: string
        title: string
        start: string
        end: string
        resources?: Array<TResource | string>
        consumption?: Array<number>
      }) => { blocked: boolean; conflict?: AvailabilityConflict; message?: string }
    }
  }
}
