import type {
  Event,
  EventDateTimeInput,
  EventDependency,
  RecurrenceEditScope,
  Resource,
  SaveEventResult,
} from '../types'

/** API contributed by `recurrenceFeature` — scoped edits/removes + occurrence nav. */
export interface Calendar_Recurrence<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  /** Edit one occurrence, this-and-following, or the whole series. */
  editRecurringEvent: (
    eventId: string,
    updates: Partial<Omit<TEvent, 'id'>>,
    options: {
      scope: RecurrenceEditScope
      occurrenceStart?: EventDateTimeInput
      dependsOn?: Array<EventDependency>
    },
  ) => Promise<SaveEventResult>
  /** Remove one occurrence, this-and-following, or the whole series. */
  removeRecurringEvent: (
    eventId: string,
    options: {
      scope: RecurrenceEditScope
      occurrenceStart?: EventDateTimeInput
    },
  ) => void
  /** Navigate to the next occurrence after `fromDate` (defaults to activeDate). */
  goToNextOccurrence: (
    eventId: string,
    fromDate?: EventDateTimeInput,
  ) => void
  /** Navigate to the previous occurrence before `fromDate` (defaults to activeDate). */
  goToPreviousOccurrence: (
    eventId: string,
    fromDate?: EventDateTimeInput,
  ) => void
}
