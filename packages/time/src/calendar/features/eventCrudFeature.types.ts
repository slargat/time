import type { Event, EventDependency, Resource, SaveEventResult } from '../types'

/** API contributed by `eventCrudFeature` — add/edit/remove single events. */
export interface Calendar_Crud<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  /** Add an event. Resolves `{ success: true }` once committed. */
  addEvent: (
    event: TEvent,
    options?: { dependsOn?: Array<EventDependency> },
  ) => Promise<SaveEventResult>
  /** Merge updates into an existing event. */
  editEvent: (
    eventId: string,
    updates: Partial<Omit<TEvent, 'id'>>,
    options?: { dependsOn?: Array<EventDependency> },
  ) => Promise<SaveEventResult>
  /** Remove an event by id. */
  removeEvent: (id: string) => void
}
