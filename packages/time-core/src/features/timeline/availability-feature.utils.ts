import { toPlainDateTimeString } from '../../date-utils'
import { checkEventAvailability } from './availability'
import type {
  AvailabilityContext,
  MinuteRange,
  ResourceDayAvail,
} from './availability'
import type { Calendar_Internal } from '../../types/calendar'
import type { ProjectionContext, WriteBatch } from '../../pipeline/stages'
import type { AvailabilityConflict, Resource } from '../../types'

/** Per-calendar availability memo caches (resource×weekday, merged ranges). */
export interface AvailabilityCaches {
  resourceDayAvailCache: Map<string, ResourceDayAvail>
  mergedUnavailMinuteCache: Map<string, Array<MinuteRange>>
  weekdayCache: Map<string, number>
}

export function createAvailabilityCaches(): AvailabilityCaches {
  return {
    resourceDayAvailCache: new Map(),
    mergedUnavailMinuteCache: new Map(),
    weekdayCache: new Map(),
  }
}

/** Build the availability context from the live calendar (resources + caches). */
function availabilityContext(
  calendar: Calendar_Internal<any, any, any>,
): AvailabilityContext<any, any> {
  const caches = calendar._availability as AvailabilityCaches
  return {
    resources: (calendar.options.resources ?? null) as Array<Resource> | null,
    events: calendar.getEvents(),
    ...caches,
  }
}

/**
 * The `availabilityFilter` projection stage: drop generated recurring
 * occurrences that land on a resource's unavailable time (matching the original
 * — manually-placed, non-recurring events are never dropped). No-op when no
 * resources are configured.
 */
export function availability_filter(
  ctx: ProjectionContext,
  calendar: Calendar_Internal<any, any, any>,
): ProjectionContext {
  const av = availabilityContext(calendar)
  if (!av.resources || av.resources.length === 0) return ctx
  return {
    ...ctx,
    events: ctx.events.filter((event) => {
      if (!event._recurringMasterId || !event.resources?.length) return true
      return !checkEventAvailability(
        event,
        toPlainDateTimeString(event.start),
        toPlainDateTimeString(event.end),
        av,
      )
    }),
  }
}

/**
 * The `availabilityValidate` write stage (veto-only): reject the batch if any
 * created/updated event with resources lands on unavailable time. Runs after
 * `dependencyTransform`, before `commit` (kernel order).
 */
export function availability_validate(
  batch: WriteBatch,
  calendar: Calendar_Internal<any, any, any>,
): WriteBatch {
  if (batch.rejected) return batch
  const av = availabilityContext(calendar)
  if (!av.resources || av.resources.length === 0) return batch
  for (const op of batch.ops) {
    if (op.kind === 'remove' || !op.event.resources?.length) continue
    const conflict = checkEventAvailability(
      op.event,
      toPlainDateTimeString(op.event.start),
      toPlainDateTimeString(op.event.end),
      av,
    )
    if (conflict) return { ...batch, rejected: { reason: conflict.description } }
  }
  return batch
}

/** Imperative placement check (UI / dependency validation use this). */
export function calendar_validateEventPlacement(
  calendar: Calendar_Internal<any, any, any>,
  input: {
    id: string
    title: string
    start: string
    end: string
    resources?: Array<Resource | string>
    consumption?: Array<number>
  },
): { blocked: boolean; conflict?: AvailabilityConflict; message?: string } {
  const av = availabilityContext(calendar)
  const conflict = checkEventAvailability(
    input as any,
    input.start,
    input.end,
    av,
    input.resources,
    input.consumption,
  )
  return conflict
    ? { blocked: true, conflict, message: conflict.description }
    : { blocked: false }
}
