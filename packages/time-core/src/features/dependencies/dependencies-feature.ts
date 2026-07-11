import { toPlainDateTimeString } from '../../date-utils'
import { assignCalendarAPIs } from '../../utils'
import { calendar_dispatchWrite } from '../../pipeline/dispatch-write'
import { checkEventAvailability } from '../timeline/availability'
import {
  buildDependentsMap,
  dependency_transform,
  epochMs,
  getAffectedByDelta,
  requiredBackwardShiftMs,
  requiredForwardShiftMs,
  shiftInstant,
} from './dependencies-feature.utils'
import type { Temporal } from '@js-temporal/polyfill'
import type { AvailabilityContext } from '../timeline/availability'
import type { Calendar_Internal } from '../../types/calendar'
import type { CalendarFeature } from '../../types/calendar-features'
import type { Event, EventDependency, ResizeError, Resource } from '../../types'
import './dependencies-feature.types'

type DependencyType = EventDependency['type']

/** Live event map + a fresh-cache availability context, built per API call. */
function liveEventMap(
  calendar: Calendar_Internal<any, any, any>,
): Map<string, Event> {
  return new Map(calendar.getEvents().map((e: Event) => [e.id, e]))
}

function availabilityCtx(
  calendar: Calendar_Internal<any, any, any>,
): AvailabilityContext<Resource, Event> {
  return {
    resources: (calendar.options.resources ?? null) as Array<Resource> | null,
    events: calendar.getEvents(),
    resourceDayAvailCache: new Map(),
    mergedUnavailMinuteCache: new Map(),
    weekdayCache: new Map(),
  }
}

/**
 * Event dependencies (opt-in). Two halves:
 * - the move CASCADE — fills the `dependencyTransform` write stage so a moving
 *   predecessor shifts its dependents inside the same atomic batch;
 * - the move VALIDATION / link APIs — `validateMove`, `validateEventDependencies`,
 *   `createDependency`, which read availability (from `options.resources`) to
 *   block placements that would push a linked event into unavailable time.
 *
 * The validation APIs commit through `calendar_dispatchWrite` (no map mutation),
 * so the cascade + history + availability-veto stages run for free.
 */
export const dependenciesFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    const tz = (calendar.options.timeZone ?? 'UTC') as Temporal.TimeZoneLike

    const validateMove = (
      eventId: string,
      newStart: string,
      newEnd: string,
      newResources?: Array<Resource | string>,
      newConsumption?: Array<number>,
    ): { blocked: boolean; blockedEventTitle?: string; message?: string } => {
      const eventMap = liveEventMap(calendar)
      const event = eventMap.get(eventId)
      if (!event || event._originalStart) return { blocked: false }

      const ctx = availabilityCtx(calendar)
      const newStartMs = epochMs(newStart, tz)
      const newEndMs = epochMs(newEnd, tz)

      // predecessors pulled earlier must stay inside their availability
      if (event.dependsOn?.length) {
        const visited = new Set<string>([eventId])
        const queue = [{ id: eventId, startMs: newStartMs, endMs: newEndMs }]
        while (queue.length > 0) {
          const current = queue.shift()!
          const currentEvent = eventMap.get(current.id)
          if (!currentEvent?.dependsOn?.length) continue
          for (const dep of currentEvent.dependsOn) {
            if (visited.has(dep.id)) continue
            const pred = eventMap.get(dep.id)
            if (!pred) continue
            const predStartStr = toPlainDateTimeString(pred.start)
            const predEndStr = toPlainDateTimeString(pred.end)
            const pullBackMs = requiredBackwardShiftMs(
              dep.type,
              epochMs(predStartStr, tz),
              epochMs(predEndStr, tz),
              current.startMs,
              current.endMs,
            )
            if (pullBackMs <= 0) continue
            visited.add(dep.id)
            const shiftedStart = shiftInstant(predStartStr, tz, -pullBackMs)
            const shiftedEnd = shiftInstant(predEndStr, tz, -pullBackMs)
            if (checkEventAvailability(pred, shiftedStart, shiftedEnd, ctx)) {
              return {
                blocked: true,
                blockedEventTitle: pred.title,
                message: `"${pred.title}" would be pulled into unavailable time.`,
              }
            }
            queue.push({
              id: dep.id,
              startMs: epochMs(predStartStr, tz) - pullBackMs,
              endMs: epochMs(predEndStr, tz) - pullBackMs,
            })
          }
        }
      }

      // the moved event itself
      const conflict = checkEventAvailability(
        event,
        newStart,
        newEnd,
        ctx,
        newResources,
        newConsumption,
      )
      if (conflict) {
        const isCapacity = conflict.resourceDetails.some(
          (d) => d.reason === 'capacity',
        )
        return {
          blocked: true,
          blockedEventTitle: event.title,
          message: isCapacity
            ? `"${event.title}" cannot be placed here — ${conflict.description}.`
            : `"${event.title}" cannot be placed here — it falls inside an unavailable zone.`,
        }
      }

      // dependents pushed later by the start delta
      const oldStartMs = epochMs(toPlainDateTimeString(event.start), tz)
      const startDeltaMs = newStartMs - oldStartMs
      if (startDeltaMs !== 0) {
        const affected = getAffectedByDelta(
          eventMap,
          buildDependentsMap(eventMap),
          tz,
          eventId,
          startDeltaMs,
          new Set([eventId]),
        )
        for (const { event: dep, newStart: ds, newEnd: de } of affected) {
          if (checkEventAvailability(dep, ds, de, ctx)) {
            return {
              blocked: true,
              blockedEventTitle: dep.title,
              message: `"${dep.title}" would be pushed to unavailable time.`,
            }
          }
        }
      }

      // dependents pushed later by a longer end (resize)
      const oldEndMs = epochMs(toPlainDateTimeString(event.end), tz)
      const endDeltaMs = newEndMs - oldEndMs
      if (endDeltaMs > 0) {
        const dependentsMap = buildDependentsMap(eventMap)
        const endVisited = new Set<string>([eventId])
        const endQueue = [
          { id: eventId, projStartMs: newStartMs, projEndMs: newEndMs },
        ]
        while (endQueue.length > 0) {
          const { id: curId, projStartMs, projEndMs } = endQueue.shift()!
          const succIds = dependentsMap.get(curId)
          if (!succIds?.size) continue
          for (const sId of succIds) {
            if (endVisited.has(sId)) continue
            const s = eventMap.get(sId)
            if (!s) continue
            const link = s.dependsOn?.find((d) => d.id === curId)
            if (!link) continue
            const sStartStr = toPlainDateTimeString(s.start)
            const sEndStr = toPlainDateTimeString(s.end)
            const sStartMs = epochMs(sStartStr, tz)
            const sEndMs = epochMs(sEndStr, tz)
            const shiftMs = requiredForwardShiftMs(
              link.type,
              projStartMs,
              projEndMs,
              sStartMs,
              sEndMs,
            )
            if (shiftMs <= 0) continue
            endVisited.add(sId)
            const sNewStart = shiftInstant(sStartStr, tz, shiftMs)
            const sNewEnd = shiftInstant(sEndStr, tz, shiftMs)
            if (checkEventAvailability(s, sNewStart, sNewEnd, ctx)) {
              return {
                blocked: true,
                blockedEventTitle: s.title,
                message: `"${s.title}" would be pushed into unavailable time.`,
              }
            }
            endQueue.push({
              id: sId,
              projStartMs: sStartMs + shiftMs,
              projEndMs: sEndMs + shiftMs,
            })
          }
        }
      }

      return { blocked: false }
    }

    const validateEventDependencies = (
      event: { id?: string; title: string; start: string; end: string },
      dependsOn: Array<EventDependency>,
    ): { valid: boolean; error?: ResizeError } => {
      const eventMap = liveEventMap(calendar)
      if (eventMap.size === 0) return { valid: true }
      const newStartMs = epochMs(event.start, tz)
      const newEndMs = epochMs(event.end, tz)

      for (const dep of dependsOn) {
        const pred = eventMap.get(dep.id)
        if (!pred) continue
        const shortfall = requiredForwardShiftMs(
          dep.type,
          epochMs(toPlainDateTimeString(pred.start), tz),
          epochMs(toPlainDateTimeString(pred.end), tz),
          newStartMs,
          newEndMs,
        )
        if (shortfall > 0) {
          const reason = {
            FS: `cannot start before "${pred.title}" ends`,
            SS: `cannot start before "${pred.title}" starts`,
            FF: `cannot end before "${pred.title}" ends`,
            SF: `cannot end before "${pred.title}" starts`,
          }[dep.type]
          return {
            valid: false,
            error: {
              eventId: event.id ?? '',
              eventTitle: event.title,
              reason: 'blocked',
              message: `"${event.title}" ${reason} (${dep.type})`,
              originalStart: event.start,
              originalEnd: event.end,
            },
          }
        }
      }
      return { valid: true }
    }

    const createDependency = (
      sourceId: string,
      targetId: string,
      type: DependencyType = 'FS',
    ): { blocked: boolean; error?: ResizeError } => {
      const eventMap = liveEventMap(calendar)
      const sourceEvent = eventMap.get(sourceId)
      const targetEvent = eventMap.get(targetId)
      if (!sourceEvent || !targetEvent) return { blocked: false }

      const currentDeps: Array<EventDependency> = targetEvent.dependsOn ?? []
      if (currentDeps.some((d) => d.id === sourceId && d.type === type)) {
        return { blocked: false }
      }

      const targetStartStr = toPlainDateTimeString(targetEvent.start)
      const targetEndStr = toPlainDateTimeString(targetEvent.end)
      const circularError = (message: string) => ({
        blocked: true as const,
        error: {
          eventId: targetId,
          eventTitle: targetEvent.title,
          reason: 'blocked' as const,
          message,
          originalStart: targetStartStr,
          originalEnd: targetEndStr,
        },
      })

      if (sourceId === targetId) {
        return circularError(
          'circular dependency: an event cannot depend on itself',
        )
      }

      // would the new link close a cycle? walk source's existing predecessors.
      const visited = new Set<string>()
      const stack = [sourceId]
      while (stack.length > 0) {
        const currentId = stack.pop()!
        if (currentId === targetId) {
          return circularError(
            `circular dependency: ${sourceId} already depends on ${targetId} (directly or indirectly)`,
          )
        }
        if (visited.has(currentId)) continue
        visited.add(currentId)
        const currentEvent = eventMap.get(currentId)
        for (const dep of currentEvent?.dependsOn ?? []) stack.push(dep.id)
      }

      const shiftMs = requiredForwardShiftMs(
        type,
        epochMs(toPlainDateTimeString(sourceEvent.start), tz),
        epochMs(toPlainDateTimeString(sourceEvent.end), tz),
        epochMs(targetStartStr, tz),
        epochMs(targetEndStr, tz),
      )
      const needsReschedule = shiftMs > 0
      let newTargetStart = targetStartStr
      let newTargetEnd = targetEndStr

      if (needsReschedule) {
        newTargetStart = shiftInstant(targetStartStr, tz, shiftMs)
        newTargetEnd = shiftInstant(targetEndStr, tz, shiftMs)
        const validation = validateMove(targetId, newTargetStart, newTargetEnd)
        if (validation.blocked) {
          return {
            blocked: true,
            error: {
              eventId: targetId,
              eventTitle: validation.blockedEventTitle ?? targetEvent.title,
              reason: 'unavailable-time',
              message:
                validation.message ??
                `Cannot connect (${type}): the resulting schedule would fall in unavailable time.`,
              originalStart: targetStartStr,
              originalEnd: targetEndStr,
              attemptedStart: newTargetStart,
              attemptedEnd: newTargetEnd,
            },
          }
        }
      }

      // commit through the write pipeline: dependencyTransform cascades the
      // target's own dependents, availabilityValidate vetoes, history records.
      const result = calendar_dispatchWrite(calendar, [
        {
          kind: 'update',
          event: {
            ...targetEvent,
            dependsOn: [...currentDeps, { id: sourceId, type }],
            ...(needsReschedule
              ? { start: newTargetStart, end: newTargetEnd }
              : {}),
          },
        },
      ])
      if (!result.success) {
        return {
          blocked: true,
          error: {
            ...result.error,
            eventId: targetId,
            eventTitle: targetEvent.title,
            reason: 'unavailable-time',
            originalStart: targetStartStr,
            originalEnd: targetEndStr,
            attemptedStart: newTargetStart,
            attemptedEnd: newTargetEnd,
          },
        }
      }
      return { blocked: false }
    }

    assignCalendarAPIs('dependenciesFeature', calendar, {
      calendar_validateMove: { fn: validateMove },
      calendar_validateEventDependencies: { fn: validateEventDependencies },
      calendar_createDependency: { fn: createDependency },
    })
  },

  // Single owner of the `dependencyTransform` write stage (move cascade).
  write: { dependencyTransform: dependency_transform },
}
