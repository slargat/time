import { memo } from '../../utils'
import { calendar_getViewportWindow } from '../calendar/core-calendar-feature.utils'
import type { Calendar_Internal } from '../../types/calendar'
import type {
  ProjectionContext,
  ProjectionStage,
  ProjectionStageFn,
} from '../../pipeline/stages'

/**
 * The read-projection driver — a literal port of v9 `coreRowModelsFeature`.
 *
 * Each stage is a memoized model factory that consumes the previous stage's
 * model (the `getPre*Model` chain). Order is kernel-fixed in `stages.ts`; a
 * feature fills a stage via `feature.projection[stage]`, and an UNfilled stage
 * falls through to its input (v9's manual/absent-row-model fall-through). The
 * `layout` tail is the active View's `build`, dispatched by `getView()`.
 *
 *   source → recurrenceExpand → clip → availabilityFilter → (layout = getView)
 *
 * `_projectionModels` is the lazy per-stage memo cache (v9 `table._rowModels`).
 */

/** The single owner fn of a projection stage, if a feature filled it. */
function ownerOf(
  calendar: Calendar_Internal<any, any, any>,
  stage: ProjectionStage,
): ProjectionStageFn | undefined {
  return calendar._projection.find((s) => s.stage === stage)?.fn as
    | ProjectionStageFn
    | undefined
}

/** Lazily build + cache a stage's memoized model factory. */
function modelFor(
  calendar: Calendar_Internal<any, any, any>,
  stage: ProjectionStage,
  memoDeps: () => Array<unknown>,
  compute: (...deps: Array<unknown>) => ProjectionContext,
): ProjectionContext {
  calendar._projectionModels[stage] ??= memo({ memoDeps, fn: compute })
  return calendar._projectionModels[stage]()
}

/** Head of the chain: raw collection seeded into the viewport window. */
export function calendar_getSourceModel(
  calendar: Calendar_Internal<any, any, any>,
): ProjectionContext {
  return modelFor(
    calendar,
    'source',
    // resources/timeZone aren't state but the projection's availabilityFilter and
    // clip stages read them, so a runtime `setOptions` change must recompute the
    // whole chain (passThrough stages invalidate off this head).
    () => [
      calendar.store.state.events,
      calendar.store.state.currentPeriod,
      calendar.store.state.viewMode,
      calendar.options.resources,
      calendar.options.timeZone,
    ],
    () => {
      const seed: ProjectionContext = {
        window: calendar_getViewportWindow(calendar),
        events: calendar.getEvents(),
      }
      const owner = ownerOf(calendar, 'source')
      return owner ? owner(seed, calendar) : seed
    },
  )
}

/** Generic mid-chain dispatcher: apply the stage's owner, else pass through. */
function passThroughStage(
  calendar: Calendar_Internal<any, any, any>,
  stage: ProjectionStage,
  getPrev: () => ProjectionContext,
): ProjectionContext {
  return modelFor(
    calendar,
    stage,
    () => [getPrev()],
    () => {
      const prev = getPrev()
      const owner = ownerOf(calendar, stage)
      return owner ? owner(prev, calendar) : prev
    },
  )
}

export function calendar_getRecurrenceExpandedModel(
  calendar: Calendar_Internal<any, any, any>,
): ProjectionContext {
  return passThroughStage(calendar, 'recurrenceExpand', () =>
    calendar_getSourceModel(calendar),
  )
}

export function calendar_getClippedModel(
  calendar: Calendar_Internal<any, any, any>,
): ProjectionContext {
  return passThroughStage(calendar, 'clip', () =>
    calendar_getRecurrenceExpandedModel(calendar),
  )
}

export function calendar_getAvailabilityFilteredModel(
  calendar: Calendar_Internal<any, any, any>,
): ProjectionContext {
  return passThroughStage(calendar, 'availabilityFilter', () =>
    calendar_getClippedModel(calendar),
  )
}

/** Tail input: fully projected occurrences the active View lays out. */
export function calendar_getProjectedEvents(
  calendar: Calendar_Internal<any, any, any>,
): ProjectionContext['events'] {
  return calendar_getAvailabilityFilteredModel(calendar).events
}
