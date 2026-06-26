import { Temporal } from '@js-temporal/polyfill'
import type { DependencyType, Event } from './types'
import { toPlainDateTimeString } from '~/date/parse'

/**
 * Finish-to-start (and SS/FF/SF) dependency math + cascade, extracted from
 * CalendarCore so the class and the feature-composed instance share one
 * implementation. The propagate* helpers mutate the event map in place.
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

function epochMs(value: string, tz: Temporal.TimeZoneLike): number {
  return Temporal.PlainDateTime.from(value).toZonedDateTime(tz).epochMilliseconds
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

/** Pull predecessors earlier so this event's constraints stay satisfied. */
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
    const shiftedStart = Temporal.PlainDateTime.from(predStartStr)
      .subtract({ milliseconds: pullBackMs })
      .toString({ smallestUnit: 'second' })
    const shiftedEnd = Temporal.PlainDateTime.from(predEndStr)
      .subtract({ milliseconds: pullBackMs })
      .toString({ smallestUnit: 'second' })
    eventMap.set(pred.id, { ...pred, start: shiftedStart, end: shiftedEnd })
    propagateStartDeltaBackward(eventMap, tz, dep.id, visited)
  }
}

/** Push dependents later so they stay after this event. */
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

    const shiftedStart = Temporal.PlainDateTime.from(depStartStr)
      .add({ milliseconds: shiftMs })
      .toString({ smallestUnit: 'second' })
    const shiftedEnd = Temporal.PlainDateTime.from(depEndStr)
      .add({ milliseconds: shiftMs })
      .toString({ smallestUnit: 'second' })
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
      const newStart = Temporal.PlainDateTime.from(sStartStr)
        .add({ milliseconds: shiftMs })
        .toString({ smallestUnit: 'second' })
      const newEnd = Temporal.PlainDateTime.from(sEndStr)
        .add({ milliseconds: shiftMs })
        .toString({ smallestUnit: 'second' })
      affected.push({ event: s, newStart, newEnd })
      projected.set(sId, { startMs: sStartMs + shiftMs, endMs: sEndMs + shiftMs })
      queue.push(sId)
    }
  }

  return affected
}
