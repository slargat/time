import type { Calendar_Internal } from '../types/calendar'
import type { Event, Resource } from '../types'

/**
 * The two kernel-defined ordered pipelines (ADR 0001, amended by ADR 0007).
 *
 * Features fill named stages; the KERNEL fixes the order. This is distinct from
 * the v9-style registration-order *composition* layer (construct*Apis), which only
 * assigns methods/state and is order-independent. Stages are SINGLE-OWNER: at most
 * one feature may fill a given stage (Q8). If two features ever contend for one
 * stage, split the stage in two rather than add a priority knob — a priority number
 * is the registration-order ambiguity ADR 0001 set out to kill.
 *
 * ponytail: single-owner enforced at construction; revisit only if a real
 * two-features-one-stage case appears.
 */

// ── read projection ─────────────────────────────────────────────────────────

/** Read-projection stages, in kernel-fixed order. The active View is `layout`. */
export const PROJECTION_STAGE_ORDER = [
  'source', // raw events for the window (lazyFetch/eventsFeature)
  'recurrenceExpand', // master events → occurrences (recurrenceFeature)
  'clip', // drop/trim to the viewport window (coreCalendarFeature)
  'availabilityFilter', // drop occurrences on unavailable resource time (timelineFeature)
  'layout', // arrange into the active view model (the active View)
] as const
export type ProjectionStage = (typeof PROJECTION_STAGE_ORDER)[number]

/** The data threaded through the projection chain. Shape firms up as stages land. */
export interface ProjectionContext<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  /** Inclusive ISO window the projection covers. */
  window: { start: string; end: string }
  /** Working set, transformed stage-by-stage. */
  events: Array<TEvent>
}

export type ProjectionStageFn<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> = (
  ctx: ProjectionContext<TResource, TEvent>,
  calendar: Calendar_Internal<any, TResource, TEvent>,
) => ProjectionContext<TResource, TEvent>

export type ProjectionStageFns = Partial<Record<ProjectionStage, ProjectionStageFn>>

// ── write pipeline ──────────────────────────────────────────────────────────

/**
 * Write stages, in kernel-fixed order. No v9 analogue — tables don't cascade
 * writes. Validation is veto-only and kept separate from transformation; one
 * user action produces one atomic batch (ADR 0001).
 */
export const WRITE_STAGE_ORDER = [
  'recurrenceMaterialize', // edit-scope → concrete writes (recurrenceFeature)
  'dependencyTransform', // cascade dependent-event shifts (dependenciesFeature)
  'availabilityValidate', // veto-only conflict check (timelineFeature)
  'commit', // apply to the event collection (eventCrudFeature)
] as const
export type WriteStage = (typeof WRITE_STAGE_ORDER)[number]

/** A single write operation in a batch. Firms up with eventCrudFeature. */
export interface WriteOp<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  kind: 'create' | 'update' | 'remove'
  event: TEvent
}

export interface WriteBatch<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  ops: Array<WriteOp<TResource, TEvent>>
  /** Set by `availabilityValidate` to veto the batch. */
  rejected?: { reason: string }
}

export type WriteStageFn<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> = (
  batch: WriteBatch<TResource, TEvent>,
  calendar: Calendar_Internal<any, TResource, TEvent>,
) => WriteBatch<TResource, TEvent>

export type WriteStageFns = Partial<Record<WriteStage, WriteStageFn>>
