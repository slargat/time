import { toPlainDateTimeString } from '../date-utils'
import type { Calendar_Internal } from '../types/calendar'
import type { WriteBatch, WriteOp, WriteStageFn } from './stages'
import type { SaveEventResult } from '../types'

/**
 * The write-dispatch driver — the one genuine extension beyond v9 `table-core`
 * (tables don't cascade writes; ADR 0001/0007).
 *
 * Folds a single batch through the kernel-ordered `_write` chain
 * (`recurrenceMaterialize → dependencyTransform → availabilityValidate →
 * commit`) as ONE atomic action. Validation stages are veto-only: they set
 * `batch.rejected`, which short-circuits the fold BEFORE `commit` runs, so a
 * rejected batch never touches the collection. `commit` replaces the `events`
 * slice once, so one user action → one re-render regardless of op count.
 *
 * Returns the original `SaveEventResult` shape (a `ResizeError` on veto), built
 * from the first op + the rejecting stage's reason.
 */
export function calendar_dispatchWrite(
  calendar: Calendar_Internal<any, any, any>,
  ops: Array<WriteOp>,
): SaveEventResult {
  // A batch with no `commit` owner would fold to a silent `{ success: true }`
  // while nothing is written. Fail loudly instead — the feature owning `commit`
  // (eventCrudFeature) is missing. Checked at dispatch (not construction) so
  // read-only use of features that *also* fill a write stage — e.g. recurrence
  // expansion without editing — isn't forced to register eventCrudFeature.
  if (!calendar._write.some((s) => s.stage === 'commit')) {
    throw new Error(
      "[time-core] a write was dispatched but no feature owns the 'commit' stage. Register `eventCrudFeature` to enable writes (create/update/remove, resize, recurrence edits, dependency cascades).",
    )
  }

  let batch: WriteBatch = { ops }
  for (const { fn } of calendar._write) {
    batch = (fn as WriteStageFn)(batch, calendar)
    if (batch.rejected) break // veto stages precede commit in kernel order
  }
  if (!batch.rejected) return { success: true }

  const op = ops[0]
  return {
    success: false,
    error: {
      eventId: op?.event.id ?? '',
      eventTitle: op?.event.title ?? '',
      reason: 'blocked',
      message: batch.rejected.reason,
      originalStart: op ? toPlainDateTimeString(op.event.start) : '',
      originalEnd: op ? toPlainDateTimeString(op.event.end) : '',
    },
  }
}
