import { calendar_setEvents } from '../../core/events/core-events-feature.utils'
import type { Calendar_Internal } from '../../types/calendar'
import type { WriteBatch } from '../../pipeline/stages'

/**
 * The `commit` write stage (owned by `eventCrudFeature`): apply the batch's ops
 * to the collection and persist once. Self-guards on `rejected` — defensive, as
 * `dispatchWrite` already short-circuits before reaching commit.
 *
 * Reaches the collection only through `core-events` static fns (no `as unknown
 * as` cast — the wiring ADR 0007 mandates).
 */
export function eventCrud_commit(
  batch: WriteBatch<any, any>,
  calendar: Calendar_Internal<any, any, any>,
): WriteBatch<any, any> {
  if (batch.rejected) return batch
  const next = new Map<string, any>(
    calendar.getEvents().map((event: any) => [event.id, event]),
  )
  for (const op of batch.ops) {
    if (op.kind === 'remove') next.delete(op.event.id)
    else next.set(op.event.id, op.event)
  }
  calendar_setEvents(calendar, [...next.values()])
  return batch
}
