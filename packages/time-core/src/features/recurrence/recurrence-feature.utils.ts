import { toPlainDateTimeString } from '../../date-utils'
import { expandRecurringEvent } from './expand-recurring-event'
import type { Temporal } from '@js-temporal/polyfill'
import type { Calendar_Internal } from '../../types/calendar'
import type { ProjectionContext, WriteBatch } from '../../pipeline/stages'
import type { Event, EventDateTimeInput } from '../../types'

/**
 * Normalize a recurrence rule's flexible date inputs (exDates, override
 * boundaries) to wall-time strings in `timeZone` (grilling decision 2 — absolute
 * inputs coerce via the calendar's zone). Salvaged from `@tanstack/time`'s
 * `recurrence.ts`. Date-only exDates (`YYYY-MM-DD`) stay date-only.
 */
export function normalizeRecurrenceDateTimeInputs<
  TRule extends NonNullable<Event['recurrence']>,
>(rule: TRule, timeZone: Temporal.TimeZoneLike = 'UTC'): TRule {
  const toWall = (value: EventDateTimeInput) =>
    toPlainDateTimeString(value, timeZone)
  return {
    ...rule,
    exDates: rule.exDates?.map((value) =>
      typeof value === 'string' && !value.includes('T') ? value : toWall(value),
    ),
    overrides: rule.overrides?.map((override) => ({
      ...override,
      originalStart:
        typeof override.originalStart === 'string' &&
        !override.originalStart.includes('T')
          ? override.originalStart
          : toWall(override.originalStart),
      ...(override.start != null
        ? { start: toWall(override.start as EventDateTimeInput) }
        : {}),
      ...(override.end != null
        ? { end: toWall(override.end as EventDateTimeInput) }
        : {}),
    })),
  }
}

/**
 * The `recurrenceExpand` projection stage: replace each recurring master with
 * its in-window occurrences; non-recurring events pass through. Runs before
 * `clip` (kernel order), which trims the rest.
 */
export function recurrence_expand(ctx: ProjectionContext): ProjectionContext {
  const { start, end } = ctx.window
  const events: Array<Event> = []
  for (const event of ctx.events) {
    if (event.recurrence) events.push(...expandRecurringEvent(event, start, end))
    else events.push(event)
  }
  return { ...ctx, events }
}

/**
 * The `recurrenceMaterialize` write stage: normalize a recurring master's rule
 * on create/update before it is committed. Runs before `commit` (kernel order).
 *
 * ponytail: this normalizes whole-master recurring writes. Scoped occurrence
 * editing (`this` / `thisAndFollowing` — exDates, overrides, split events) plus
 * the `editRecurringEvent`/`removeRecurringEvent` public API is the documented
 * follow-up that extends this stage; it needs edit-scope to ride the write batch.
 */
export function recurrence_materialize(
  batch: WriteBatch,
  calendar: Calendar_Internal<any, any, any>,
): WriteBatch {
  if (batch.rejected) return batch
  const timeZone = calendar.options.timeZone ?? 'UTC'
  return {
    ...batch,
    ops: batch.ops.map((op) =>
      op.kind === 'remove' || !op.event.recurrence
        ? op
        : {
            ...op,
            event: {
              ...op.event,
              recurrence: normalizeRecurrenceDateTimeInputs(
                op.event.recurrence,
                timeZone,
              ),
            },
          },
    ),
  }
}
