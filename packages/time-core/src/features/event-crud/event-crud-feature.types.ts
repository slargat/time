import type { CalendarFeatures } from '../../types/calendar-features'
import type { Event, Resource, SaveEventResult } from '../../types'

/**
 * Register `eventCrudFeature`'s APIs onto the calendar instance, present in the
 * type exactly when the feature is registered (same inference as the View
 * feature maps).
 */
declare module '../../types/calendar' {
  interface Calendar_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    eventCrudFeature: {
      /** Add an event; flows through the write pipeline as one atomic batch. */
      createEvent: (event: TEvent) => Promise<SaveEventResult>
      /** Patch an existing event by id; no-op success if the id is unknown. */
      updateEvent: (
        id: string,
        updates: Partial<Omit<TEvent, 'id'>>,
      ) => Promise<SaveEventResult>
      /** Remove an event by id; no-op success if the id is unknown. */
      removeEvent: (id: string) => Promise<SaveEventResult>
    }
  }
}
