import type {
  DependencyType,
  EventDependency,
  ResizeError,
  Resource,
} from '../types'

/** API contributed by `dependenciesFeature` — links + cascade validation. */
export interface Calendar_Dependencies<TResource extends Resource = Resource> {
  /** Whether moving an event (and cascading dependents) violates availability. */
  validateMove: (
    eventId: string,
    newStart: string,
    newEnd: string,
    newResources?: Array<TResource | string>,
    newConsumption?: Array<number>,
  ) => { blocked: boolean; blockedEventTitle?: string; message?: string }
  /** Whether a placement satisfies its dependency constraints. */
  validateEventDependencies: (
    event: { id?: string; title: string; start: string; end: string },
    dependsOn: Array<EventDependency>,
  ) => { valid: boolean; error?: ResizeError }
  /** Create a source→target link, rescheduling the target if needed. */
  createDependency: (
    sourceId: string,
    targetId: string,
    type?: DependencyType,
  ) => { blocked: boolean; error?: ResizeError }
}
