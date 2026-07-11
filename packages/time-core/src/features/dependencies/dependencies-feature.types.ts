import type { Event, EventDependency, ResizeError, Resource } from '../../types'
import type { CalendarFeatures } from '../../types/calendar-features'

/** API contributed by `dependenciesFeature` (validation + link creation). */
declare module '../../types/calendar' {
  interface Calendar_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    dependenciesFeature: {
      /**
       * Whether moving `eventId` to `[newStart, newEnd)` would push/pull any
       * dependency-linked event into unavailable time (read-only, commits nothing).
       */
      validateMove: (
        eventId: string,
        newStart: string,
        newEnd: string,
        newResources?: Array<TResource | string>,
        newConsumption?: Array<number>,
      ) => { blocked: boolean; blockedEventTitle?: string; message?: string }
      /** Whether `event` at its current times satisfies the given `dependsOn` links. */
      validateEventDependencies: (
        event: { id?: string; title: string; start: string; end: string },
        dependsOn: Array<EventDependency>,
      ) => { valid: boolean; error?: ResizeError }
      /**
       * Link `targetId` to depend on `sourceId` (default `FS`), rescheduling the
       * target via the write pipeline when the link requires it. Rejects circular
       * links and reschedules that would land in unavailable time.
       */
      createDependency: (
        sourceId: string,
        targetId: string,
        type?: EventDependency['type'],
      ) => { blocked: boolean; error?: ResizeError }
    }
  }
}
