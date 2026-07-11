import { Temporal } from '@js-temporal/polyfill'
import { toPlainDateTimeString } from '../../date-utils'
import type { Calendar_Internal } from '../../types/calendar'
import type { WriteBatch, WriteOp } from '../../pipeline/stages'
import type { Event, EventDependency } from '../../types'

type DependencyType = EventDependency['type']

/**
 * Finish-to-start (and SS/FF/SF) dependency math + cascade. Salvaged from
 * `@tanstack/time`'s `dependencies.ts`. The `propagate*` helpers mutate the
 * passed event map in place.
 */

export function requiredForwardShiftMs(
  type: DependencyType,
  predStartMs: number,
  predEndMs: number,
  succStartMs: number,
  succEndMs: number,
): number {
  switch (type) {
    case 'FS':
      return predEndMs - succStartMs
    case 'SS':
      return predStartMs - succStartMs
    case 'FF':
      return predEndMs - succEndMs
    case 'SF':
      return predStartMs - succEndMs
  }
}

export const requiredBackwardShiftMs = requiredForwardShiftMs

export function epochMs(value: string, tz: Temporal.TimeZoneLike): number {
  return Temporal.PlainDateTime.from(value).toZonedDateTime(tz).epochMilliseconds
}

/**
 * Apply an instant-domain shift (ms) to a zone-less wall-time string, preserving
 * the real-time relationship across DST. `epochMs` measures the shift in the
 * instant domain, so it must be applied there too — wall-clock `PlainDateTime`
 * ms arithmetic lands an hour off across a DST transition. Negative ms shifts
 * backward.
 */
export function shiftInstant(
  value: string,
  tz: Temporal.TimeZoneLike,
  ms: number,
): string {
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime(tz)
    .add({ milliseconds: ms })
    .toPlainDateTime()
    .toString({ smallestUnit: 'second' })
}

/** Build `predecessorId -> Set<dependentId>` from the current events. */
export function buildDependentsMap<TEvent extends Event>(
  eventMap: Map<string, TEvent>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const event of eventMap.values()) {
    for (const dep of event.dependsOn ?? []) {
      let set = map.get(dep.id)
      if (!set) {
        set = new Set()
        map.set(dep.id, set)
      }
      set.add(event.id)
    }
  }
  return map
}

/** Pull predecessors earlier so the source event's constraints stay satisfied. */
export function propagateStartDeltaBackward<TEvent extends Event>(
  eventMap: Map<string, TEvent>,
  tz: Temporal.TimeZoneLike,
  sourceId: string,
  visited: Set<string>,
): void {
  const sourceEvent = eventMap.get(sourceId)
  if (!sourceEvent?.dependsOn?.length) return

  const sourceStartMs = epochMs(toPlainDateTimeString(sourceEvent.start), tz)
  const sourceEndMs = epochMs(toPlainDateTimeString(sourceEvent.end), tz)

  for (const dep of sourceEvent.dependsOn) {
    if (visited.has(dep.id)) continue
    const pred = eventMap.get(dep.id)
    if (!pred) continue

    const predStartStr = toPlainDateTimeString(pred.start)
    const predEndStr = toPlainDateTimeString(pred.end)
    const pullBackMs = requiredBackwardShiftMs(
      dep.type,
      epochMs(predStartStr, tz),
      epochMs(predEndStr, tz),
      sourceStartMs,
      sourceEndMs,
    )
    if (pullBackMs <= 0) continue

    visited.add(dep.id)
    const shiftedStart = shiftInstant(predStartStr, tz, -pullBackMs)
    const shiftedEnd = shiftInstant(predEndStr, tz, -pullBackMs)
    eventMap.set(pred.id, { ...pred, start: shiftedStart, end: shiftedEnd })
    propagateStartDeltaBackward(eventMap, tz, dep.id, visited)
  }
}

/** Push dependents later so they stay after the source event. */
export function propagateEndDelta<TEvent extends Event>(
  eventMap: Map<string, TEvent>,
  dependentsMap: Map<string, Set<string>>,
  tz: Temporal.TimeZoneLike,
  sourceId: string,
  visited: Set<string>,
): void {
  const sourceEvent = eventMap.get(sourceId)
  if (!sourceEvent) return

  const sourceStartMs = epochMs(toPlainDateTimeString(sourceEvent.start), tz)
  const sourceEndMs = epochMs(toPlainDateTimeString(sourceEvent.end), tz)

  const dependentIds = dependentsMap.get(sourceId)
  if (!dependentIds || dependentIds.size === 0) return

  for (const depId of dependentIds) {
    if (visited.has(depId)) continue
    const dependent = eventMap.get(depId)
    if (!dependent) continue
    const link = dependent.dependsOn?.find((d) => d.id === sourceId)
    if (!link) continue

    visited.add(dependent.id)
    const depStartStr = toPlainDateTimeString(dependent.start)
    const depEndStr = toPlainDateTimeString(dependent.end)
    const shiftMs = requiredForwardShiftMs(
      link.type,
      sourceStartMs,
      sourceEndMs,
      epochMs(depStartStr, tz),
      epochMs(depEndStr, tz),
    )
    if (shiftMs <= 0) continue

    const shiftedStart = shiftInstant(depStartStr, tz, shiftMs)
    const shiftedEnd = shiftInstant(depEndStr, tz, shiftMs)
    eventMap.set(dependent.id, {
      ...dependent,
      start: shiftedStart,
      end: shiftedEnd,
    })
    propagateEndDelta(eventMap, dependentsMap, tz, dependent.id, visited)
  }
}

/** Read-only projection of which dependents a delta would shift (and to where). */
export function getAffectedByDelta<TEvent extends Event>(
  eventMap: Map<string, TEvent>,
  dependentsMap: Map<string, Set<string>>,
  tz: Temporal.TimeZoneLike,
  sourceId: string,
  deltaMs: number,
  visited: Set<string>,
): Array<{ event: TEvent; newStart: string; newEnd: string }> {
  if (deltaMs === 0) return []

  const affected: Array<{ event: TEvent; newStart: string; newEnd: string }> = []
  const projected = new Map<string, { startMs: number; endMs: number }>()

  const sourceEvent = eventMap.get(sourceId)
  if (!sourceEvent) return []

  const srcStartMs =
    epochMs(toPlainDateTimeString(sourceEvent.start), tz) + deltaMs
  const srcEndMs = epochMs(toPlainDateTimeString(sourceEvent.end), tz) + deltaMs
  projected.set(sourceId, { startMs: srcStartMs, endMs: srcEndMs })

  const queue: Array<string> = [sourceId]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const cur = projected.get(currentId)!
    const successorIds = dependentsMap.get(currentId)
    if (!successorIds || successorIds.size === 0) continue

    for (const sId of successorIds) {
      if (visited.has(sId)) continue
      const s = eventMap.get(sId)
      if (!s) continue
      const link = s.dependsOn?.find((d) => d.id === currentId)
      if (!link) continue

      const sStartStr = toPlainDateTimeString(s.start)
      const sEndStr = toPlainDateTimeString(s.end)
      const sStartMs = epochMs(sStartStr, tz)
      const sEndMs = epochMs(sEndStr, tz)
      const shiftMs = requiredForwardShiftMs(
        link.type,
        cur.startMs,
        cur.endMs,
        sStartMs,
        sEndMs,
      )
      if (shiftMs <= 0) continue

      visited.add(sId)
      const newStart = shiftInstant(sStartStr, tz, shiftMs)
      const newEnd = shiftInstant(sEndStr, tz, shiftMs)
      affected.push({ event: s, newStart, newEnd })
      projected.set(sId, {
        startMs: sStartMs + shiftMs,
        endMs: sEndMs + shiftMs,
      })
      queue.push(sId)
    }
  }

  return affected
}

const signature = (event: Event) =>
  `${toPlainDateTimeString(event.start)}|${toPlainDateTimeString(event.end)}`

/**
 * The `dependencyTransform` write stage: after the batch's edits, cascade
 * predecessor/dependent shifts and append the moved events as extra update ops.
 * Runs before `commit` (kernel order); `commit` then applies edits + cascade as
 * one atomic batch, so one user action is one re-render.
 *
 * ponytail: cascade only. Move-blocking validation (`validateMove`,
 * `createDependency`) needs availability — it lands with the timeline feature.
 */
export function dependency_transform(
  batch: WriteBatch,
  calendar: Calendar_Internal<any, any, any>,
): WriteBatch {
  if (batch.rejected) return batch
  const tz = (calendar.options.timeZone ?? 'UTC') as Temporal.TimeZoneLike

  const map = new Map<string, Event>(
    calendar.getEvents().map((event: Event) => [event.id, event]),
  )
  for (const op of batch.ops) {
    if (op.kind === 'remove') map.delete(op.event.id)
    else map.set(op.event.id, op.event)
  }

  // positions after the edits but before the cascade
  const before = new Map<string, string>(
    [...map].map(([id, event]) => [id, signature(event)]),
  )

  const dependentsMap = buildDependentsMap(map)
  for (const op of batch.ops) {
    if (op.kind === 'remove') continue
    const visited = new Set<string>([op.event.id])
    propagateStartDeltaBackward(map, tz, op.event.id, visited)
    propagateEndDelta(map, dependentsMap, tz, op.event.id, visited)
  }

  const opIds = new Set(batch.ops.map((op) => op.event.id))
  const extra: Array<WriteOp> = []
  for (const [id, event] of map) {
    if (opIds.has(id)) continue
    if (before.get(id) !== signature(event)) {
      extra.push({ kind: 'update', event })
    }
  }

  return extra.length ? { ...batch, ops: [...batch.ops, ...extra] } : batch
}
