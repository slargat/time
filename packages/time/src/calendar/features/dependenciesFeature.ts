import { Temporal } from '@js-temporal/polyfill'
import { checkEventAvailability } from '../availability'
import {
  buildDependentsMap,
  getAffectedByDelta,
  propagateEndDelta,
  propagateStartDeltaBackward,
  requiredBackwardShiftMs,
  requiredForwardShiftMs,
} from '../dependencies'
import type {
  AvailabilityContext,
  MinuteRange,
  ResourceDayAvail,
} from '../availability'
import type {
  DependencyType,
  Event,
  EventDependency,
  Resource,
} from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'
import { toPlainDateTimeString } from '~/date/parse'

/**
 * Event dependencies: validation (`validateMove`, `validateEventDependencies`),
 * link creation (`createDependency`), and the move cascade. Installs a
 * `_propagateDependents` hook that crud/resize commits call so moving a
 * predecessor shifts its dependents. Requires `eventsFeature`.
 */
export const dependenciesFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const tz = calendar.options.timeZone ?? 'UTC'
    const internals = calendar as unknown as {
      _eventMap: Map<string, TEvent>
      _normalizeEvent: (event: TEvent) => TEvent
      _bumpEvents: () => void
      _pushHistory?: () => void
    }

    // Own availability caches (shared logic with timelineFeature; returns null
    // when no resources are configured, so dependency validation works alone).
    const resourceDayAvailCache = new Map<string, ResourceDayAvail>()
    const mergedUnavailMinuteCache = new Map<string, Array<MinuteRange>>()
    const weekdayCache = new Map<string, number>()
    const ctx = (): AvailabilityContext<TResource, TEvent> => ({
      resources: calendar.options.resources ?? null,
      events: internals._eventMap.values(),
      resourceDayAvailCache,
      mergedUnavailMinuteCache,
      weekdayCache,
    })

    const epochMs = (value: string) =>
      Temporal.PlainDateTime.from(value).toZonedDateTime(tz).epochMilliseconds

    const propagateDependents = (eventId: string) => {
      const dependentsMap = buildDependentsMap(internals._eventMap)
      const visited = new Set<string>([eventId])
      propagateStartDeltaBackward(internals._eventMap, tz, eventId, visited)
      propagateEndDelta(internals._eventMap, dependentsMap, tz, eventId, visited)
    }
    ;(
      calendar as unknown as { _propagateDependents?: (id: string) => void }
    )._propagateDependents = propagateDependents

    calendar.validateMove = (
      eventId,
      newStart,
      newEnd,
      newResources,
      newConsumption,
    ) => {
      const event = internals._eventMap.get(eventId)
      if (!event || event._originalStart) return { blocked: false }

      const newStartMs = epochMs(newStart)
      const newEndMs = epochMs(newEnd)

      if (event.dependsOn?.length) {
        const visited = new Set<string>([eventId])
        const queue = [{ id: eventId, startMs: newStartMs, endMs: newEndMs }]
        while (queue.length > 0) {
          const current = queue.shift()!
          const currentEvent = internals._eventMap.get(current.id)
          if (!currentEvent?.dependsOn?.length) continue
          for (const dep of currentEvent.dependsOn) {
            if (visited.has(dep.id)) continue
            const pred = internals._eventMap.get(dep.id)
            if (!pred) continue
            const predStartStr = toPlainDateTimeString(pred.start)
            const predEndStr = toPlainDateTimeString(pred.end)
            const pullBackMs = requiredBackwardShiftMs(
              dep.type,
              epochMs(predStartStr),
              epochMs(predEndStr),
              current.startMs,
              current.endMs,
            )
            if (pullBackMs <= 0) continue
            visited.add(dep.id)
            const shiftedStart = Temporal.PlainDateTime.from(predStartStr)
              .subtract({ milliseconds: pullBackMs })
              .toString({ smallestUnit: 'second' })
            const shiftedEnd = Temporal.PlainDateTime.from(predEndStr)
              .subtract({ milliseconds: pullBackMs })
              .toString({ smallestUnit: 'second' })
            const predConflict = checkEventAvailability(
              pred,
              shiftedStart,
              shiftedEnd,
              ctx(),
            )
            if (predConflict) {
              return {
                blocked: true,
                blockedEventTitle: pred.title,
                message: `"${pred.title}" would be pulled into unavailable time.`,
              }
            }
            queue.push({
              id: dep.id,
              startMs: epochMs(predStartStr) - pullBackMs,
              endMs: epochMs(predEndStr) - pullBackMs,
            })
          }
        }
      }

      const conflict = checkEventAvailability(
        event,
        newStart,
        newEnd,
        ctx(),
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

      const oldStartMs = epochMs(toPlainDateTimeString(event.start))
      const startDeltaMs = newStartMs - oldStartMs
      if (startDeltaMs !== 0) {
        const affected = getAffectedByDelta(
          internals._eventMap,
          buildDependentsMap(internals._eventMap),
          tz,
          eventId,
          startDeltaMs,
          new Set([eventId]),
        )
        for (const { event: dep, newStart: depStart, newEnd: depEnd } of affected) {
          if (checkEventAvailability(dep, depStart, depEnd, ctx())) {
            return {
              blocked: true,
              blockedEventTitle: dep.title,
              message: `"${dep.title}" would be pushed to unavailable time.`,
            }
          }
        }
      }

      const oldEndMs = epochMs(toPlainDateTimeString(event.end))
      const endDeltaMs = newEndMs - oldEndMs
      if (endDeltaMs > 0) {
        const dependentsMap = buildDependentsMap(internals._eventMap)
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
            const s = internals._eventMap.get(sId)
            if (!s) continue
            const link = s.dependsOn?.find((d) => d.id === curId)
            if (!link) continue
            const sStartStr = toPlainDateTimeString(s.start)
            const sEndStr = toPlainDateTimeString(s.end)
            const sStartMs = epochMs(sStartStr)
            const sEndMs = epochMs(sEndStr)
            const shiftMs = requiredForwardShiftMs(
              link.type,
              projStartMs,
              projEndMs,
              sStartMs,
              sEndMs,
            )
            if (shiftMs <= 0) continue
            endVisited.add(sId)
            const sNewStart = Temporal.PlainDateTime.from(sStartStr)
              .add({ milliseconds: shiftMs })
              .toString({ smallestUnit: 'second' })
            const sNewEnd = Temporal.PlainDateTime.from(sEndStr)
              .add({ milliseconds: shiftMs })
              .toString({ smallestUnit: 'second' })
            if (checkEventAvailability(s, sNewStart, sNewEnd, ctx())) {
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

    calendar.validateEventDependencies = (event, dependsOn) => {
      if (internals._eventMap.size === 0) return { valid: true }
      const newStartMs = epochMs(event.start)
      const newEndMs = epochMs(event.end)

      for (const dep of dependsOn) {
        const pred = internals._eventMap.get(dep.id)
        if (!pred) continue
        const shortfall = requiredForwardShiftMs(
          dep.type,
          epochMs(toPlainDateTimeString(pred.start)),
          epochMs(toPlainDateTimeString(pred.end)),
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

    calendar.createDependency = (
      sourceId,
      targetId,
      type: DependencyType = 'FS',
    ) => {
      const sourceEvent = internals._eventMap.get(sourceId)
      const targetEvent = internals._eventMap.get(targetId)
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
        const currentEvent = internals._eventMap.get(currentId)
        for (const dep of currentEvent?.dependsOn ?? []) stack.push(dep.id)
      }

      const shiftMs = requiredForwardShiftMs(
        type,
        epochMs(toPlainDateTimeString(sourceEvent.start)),
        epochMs(toPlainDateTimeString(sourceEvent.end)),
        epochMs(targetStartStr),
        epochMs(targetEndStr),
      )
      const needsReschedule = shiftMs > 0
      let newTargetStart = targetStartStr
      let newTargetEnd = targetEndStr

      if (needsReschedule) {
        newTargetStart = Temporal.PlainDateTime.from(targetStartStr)
          .add({ milliseconds: shiftMs })
          .toString({ smallestUnit: 'second' })
        newTargetEnd = Temporal.PlainDateTime.from(targetEndStr)
          .add({ milliseconds: shiftMs })
          .toString({ smallestUnit: 'second' })
        const validation = calendar.validateMove(
          targetId,
          newTargetStart,
          newTargetEnd,
        )
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

      const updates = {
        dependsOn: [...currentDeps, { id: sourceId, type }],
        ...(needsReschedule
          ? { start: newTargetStart, end: newTargetEnd }
          : {}),
      } as Partial<Omit<TEvent, 'id'>>

      internals._pushHistory?.()
      internals._eventMap.set(
        targetId,
        internals._normalizeEvent({ ...targetEvent, ...updates } as TEvent),
      )
      propagateDependents(targetId)
      internals._bumpEvents()
      return { blocked: false }
    }
  },
}
