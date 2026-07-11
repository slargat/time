import type { CalendarFeatures } from '../../types/calendar-features'
import type {
  Event,
  EventDateTimeInput,
  RecurrenceEditScope,
  Resource,
  SaveEventResult,
} from '../../types'

/**
 * Register `recurrenceFeature`'s scoped-editing + occurrence-navigation APIs onto
 * the calendar instance, present in the type exactly when the feature is
 * registered (same inference as eventCrudFeature's map).
 */
declare module '../../types/calendar' {
  interface Calendar_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    recurrenceFeature: {
      /**
       * Edit a recurring series. `this` adds an exDate + override, `all` edits
       * the master, `thisAndFollowing` caps the master and splits off a new
       * series. Resolves to the write pipeline's `SaveEventResult` (a vetoed
       * placement surfaces as `{ success: false, error }`).
       */
      editRecurringEvent: (
        eventId: string,
        updates: Partial<Omit<TEvent, 'id'>>,
        options: {
          scope: RecurrenceEditScope
          occurrenceStart?: EventDateTimeInput
        },
      ) => Promise<SaveEventResult>
      /** Remove a recurring series with the same scope semantics. */
      removeRecurringEvent: (
        eventId: string,
        options: {
          scope: RecurrenceEditScope
          occurrenceStart?: EventDateTimeInput
        },
      ) => void
      /** Navigate the viewport to the next occurrence after `fromDate`. */
      goToNextOccurrence: (
        eventId: string,
        fromDate?: EventDateTimeInput,
      ) => void
      /** Navigate the viewport to the previous occurrence before `fromDate`. */
      goToPreviousOccurrence: (
        eventId: string,
        fromDate?: EventDateTimeInput,
      ) => void
    }
  }
}
