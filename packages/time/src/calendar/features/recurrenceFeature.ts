import { Temporal } from '@js-temporal/polyfill'
import { expandRecurringEvent } from '../expandRecurringEvent'
import {
  compareRecurrenceInputToOccurrence,
  durationPreservingEnd,
  getRecurringOccurrence,
  makeSplitRecurringEventId,
  normalizeRecurrenceDateTimeInputs,
  recurrenceInputMatchesOccurrence,
  resolveMasterEvent,
  resolveOccurrenceStart,
} from '../recurrence'
import type { Event, Resource, SaveEventResult } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'
import { toPlainDateTimeString } from '~/date/parse'

/**
 * Recurring-event editing/removal with `this` / `thisAndFollowing` / `all`
 * scopes, plus occurrence navigation. Mutates eventsFeature's shared map and
 * checkpoints history; placement is validated through `timelineFeature` when
 * present. Requires `eventsFeature`.
 *
 * ponytail: dependsOn validation (dependencies feature) and lazy range fetching
 * (lazyFetch feature) are skipped here — wired when those features land.
 */
export const recurrenceFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const internals = calendar as unknown as {
      _eventMap: Map<string, TEvent>
      _normalizeEvent: (event: TEvent) => TEvent
      _bumpEvents: () => void
      _pushHistory?: () => void
    }

    // Present only when timelineFeature is registered; the broad internal type
    // lists it as always-present, so read it as optional.
    const validatePlacement = calendar.validateEventPlacement as
      | typeof calendar.validateEventPlacement
      | undefined

    const commitRecurringUpdate = (
      nextMaster: TEvent,
      addedEvents: Array<TEvent>,
    ) => {
      internals._pushHistory?.()
      internals._eventMap.set(nextMaster.id, internals._normalizeEvent(nextMaster))
      for (const added of addedEvents) {
        internals._eventMap.set(added.id, internals._normalizeEvent(added))
      }
      internals._bumpEvents()
    }

    const removeMaster = (id: string) => {
      if (!internals._eventMap.has(id)) return
      internals._pushHistory?.()
      internals._eventMap.delete(id)
      internals._bumpEvents()
    }

    const blockedResult = (
      eventId: string,
      eventTitle: string,
      message: string,
      originalStart: string,
      originalEnd: string,
      attempted?: { start: string; end: string },
    ): SaveEventResult => ({
      success: false,
      error: {
        eventId,
        eventTitle,
        reason: 'blocked',
        message,
        originalStart,
        originalEnd,
        ...(attempted
          ? { attemptedStart: attempted.start, attemptedEnd: attempted.end }
          : {}),
      },
    })

    const editMaster = (
      id: string,
      updates: Partial<Omit<TEvent, 'id'>>,
    ): SaveEventResult => {
      const existing = internals._eventMap.get(id)
      if (!existing) return { success: true }
      const next = internals._normalizeEvent({ ...existing, ...updates } as TEvent)
      const changed =
        updates.start !== undefined ||
        updates.end !== undefined ||
        updates.resources !== undefined ||
        updates.consumption !== undefined
      if (changed && validatePlacement) {
        const v = validatePlacement({
          id,
          title: next.title,
          start: next.start as string,
          end: next.end as string,
          resources: next.resources,
          consumption: next.consumption,
        })
        if (v.blocked) {
          return blockedResult(
            id,
            existing.title,
            v.message ?? `Cannot move "${existing.title}" to this position.`,
            existing.start as string,
            existing.end as string,
            { start: next.start as string, end: next.end as string },
          )
        }
      }
      internals._pushHistory?.()
      internals._eventMap.set(id, next)
      internals._bumpEvents()
      return { success: true }
    }

    calendar.editRecurringEvent = (eventId, updates, options) => {
      const master = resolveMasterEvent(eventId, internals._eventMap)
      if (!master) {
        return Promise.resolve(
          blockedResult(eventId, '', `Event "${eventId}" not found.`, '', ''),
        )
      }

      if (!master.recurrence || options.scope === 'all') {
        return Promise.resolve(editMaster(master.id, updates))
      }

      const occurrenceStart = resolveOccurrenceStart(
        master,
        options.occurrenceStart,
      )
      const occurrence = getRecurringOccurrence<TResource, TEvent>(
        master,
        occurrenceStart,
      )
      if (!occurrence) {
        return Promise.resolve(
          blockedResult(
            eventId,
            master.title,
            `Occurrence "${occurrenceStart}" not found.`,
            occurrenceStart,
            occurrenceStart,
          ),
        )
      }

      const occurrenceStartStr = toPlainDateTimeString(occurrence.start)
      const occurrenceEndStr = toPlainDateTimeString(occurrence.end)
      const effectiveStart =
        updates.start != null
          ? toPlainDateTimeString(updates.start)
          : occurrenceStartStr
      const effectiveEnd =
        updates.end != null
          ? toPlainDateTimeString(updates.end)
          : updates.start != null
            ? durationPreservingEnd(
                occurrenceStartStr,
                occurrenceEndStr,
                effectiveStart,
              )
            : occurrenceEndStr

      const startChanged = updates.start !== undefined
      const endChanged = updates.end !== undefined
      const resourcesChanged = updates.resources !== undefined
      const consumptionChanged = updates.consumption !== undefined

      if (
        (startChanged || endChanged || resourcesChanged || consumptionChanged) && validatePlacement
      ) {
        const placement = validatePlacement({
          id: occurrence.id,
          title: (updates.title as string | undefined) ?? occurrence.title,
          start: effectiveStart,
          end: effectiveEnd,
          resources: updates.resources ?? occurrence.resources,
          consumption: updates.consumption ?? occurrence.consumption,
        })
        if (placement.blocked) {
          return Promise.resolve(
            blockedResult(
              eventId,
              occurrence.title,
              placement.message ??
                `Cannot move "${occurrence.title}" to this position.`,
              occurrenceStartStr,
              occurrenceEndStr,
              { start: effectiveStart, end: effectiveEnd },
            ),
          )
        }
      }

      const rule = normalizeRecurrenceDateTimeInputs(master.recurrence)
      const recurrenceUpdate = (updates as { recurrence?: TEvent['recurrence'] })
        .recurrence
      const normalizedUpdates = {
        ...updates,
        ...(updates.start != null ? { start: effectiveStart } : {}),
        ...(updates.end != null || updates.start != null
          ? { end: effectiveEnd }
          : {}),
        ...(recurrenceUpdate != null
          ? { recurrence: normalizeRecurrenceDateTimeInputs(recurrenceUpdate) }
          : {}),
      } as Partial<Omit<TEvent, 'id'>>

      if (options.scope === 'this') {
        const exDates = (rule.exDates ?? []).filter(
          (value) => !recurrenceInputMatchesOccurrence(value, occurrenceStart),
        )
        const overrides = (rule.overrides ?? []).filter(
          (override) =>
            !recurrenceInputMatchesOccurrence(
              override.originalStart,
              occurrenceStart,
            ),
        )
        const overrideFields = {
          ...(normalizedUpdates as Record<string, unknown>),
        }
        delete overrideFields.recurrence
        delete overrideFields._originalStart
        delete overrideFields._originalEnd
        delete overrideFields._recurringMasterId
        delete overrideFields._occurrenceIndex
        delete overrideFields._occurrenceOriginalStart

        overrides.push({
          ...overrideFields,
          originalStart: occurrenceStart,
          ...(updates.start != null ? { start: effectiveStart } : {}),
          ...(updates.end != null || updates.start != null
            ? { end: effectiveEnd }
            : {}),
        })

        const nextMaster = {
          ...master,
          recurrence: normalizeRecurrenceDateTimeInputs({
            ...rule,
            exDates,
            overrides,
          }),
        } as TEvent

        commitRecurringUpdate(nextMaster, [])
        return Promise.resolve({ success: true })
      }

      // scope === 'thisAndFollowing'
      const masterStart = toPlainDateTimeString(master.start)
      if (occurrenceStart === masterStart) {
        return Promise.resolve(editMaster(master.id, updates))
      }

      const splitDate = occurrenceStart.split('T')[0]!
      const oldRule = normalizeRecurrenceDateTimeInputs({
        ...rule,
        until: splitDate,
      })
      const remainingRule = normalizeRecurrenceDateTimeInputs({
        ...rule,
        ...(rule.count !== undefined && rule.until === undefined
          ? {
              count: Math.max(
                1,
                rule.count - (occurrence._occurrenceIndex ?? 0),
              ),
            }
          : {}),
        exDates: rule.exDates?.filter(
          (value) =>
            compareRecurrenceInputToOccurrence(value, occurrenceStart) > 0,
        ),
        overrides: rule.overrides?.filter(
          (override) =>
            compareRecurrenceInputToOccurrence(
              override.originalStart,
              occurrenceStart,
            ) > 0,
        ),
      })

      const updateFields = { ...(normalizedUpdates as Record<string, unknown>) }
      delete updateFields.recurrence

      const splitEvent = {
        ...occurrence,
        ...updateFields,
        id: makeSplitRecurringEventId(master, occurrenceStart, internals._eventMap),
        start: effectiveStart,
        end: effectiveEnd,
        recurrence:
          recurrenceUpdate != null
            ? normalizeRecurrenceDateTimeInputs(recurrenceUpdate)
            : remainingRule,
        _originalStart: undefined,
        _originalEnd: undefined,
        _recurringMasterId: undefined,
        _occurrenceIndex: undefined,
        _occurrenceOriginalStart: undefined,
      } as TEvent

      const nextMaster = { ...master, recurrence: oldRule } as TEvent
      commitRecurringUpdate(nextMaster, [splitEvent])
      return Promise.resolve({ success: true })
    }

    calendar.removeRecurringEvent = (eventId, options) => {
      const master = resolveMasterEvent(eventId, internals._eventMap)
      if (!master) return

      if (!master.recurrence || options.scope === 'all') {
        removeMaster(master.id)
        return
      }

      const occurrenceStart = resolveOccurrenceStart(
        master,
        options.occurrenceStart,
      )
      const occurrence = getRecurringOccurrence<TResource, TEvent>(
        master,
        occurrenceStart,
      )
      if (!occurrence) return

      const rule = normalizeRecurrenceDateTimeInputs(master.recurrence)

      if (options.scope === 'this') {
        const exDates = (rule.exDates ?? []).filter(
          (value) => !recurrenceInputMatchesOccurrence(value, occurrenceStart),
        )
        exDates.push(occurrenceStart)
        const overrides = (rule.overrides ?? []).filter(
          (override) =>
            !recurrenceInputMatchesOccurrence(
              override.originalStart,
              occurrenceStart,
            ),
        )
        const nextMaster = {
          ...master,
          recurrence: normalizeRecurrenceDateTimeInputs({
            ...rule,
            exDates,
            overrides,
          }),
        } as TEvent
        commitRecurringUpdate(nextMaster, [])
        return
      }

      if (occurrenceStart === toPlainDateTimeString(master.start)) {
        removeMaster(master.id)
        return
      }

      const nextMaster = {
        ...master,
        recurrence: normalizeRecurrenceDateTimeInputs({
          ...rule,
          until: occurrenceStart.split('T')[0]!,
        }),
      } as TEvent
      commitRecurringUpdate(nextMaster, [])
    }

    calendar.goToNextOccurrence = (eventId, fromDate) => {
      const master = resolveMasterEvent(eventId, internals._eventMap)
      if (!master?.recurrence) return

      const baseDate = fromDate
        ? Temporal.PlainDate.from(toPlainDateTimeString(fromDate).split('T')[0]!)
        : calendar.store.state.activeDate
      const windowStart = baseDate
        .add({ days: 1 })
        .toString({ calendarName: 'never' })
      const windowEnd = baseDate
        .add({ years: 4 })
        .toString({ calendarName: 'never' })

      const occurrences = expandRecurringEvent<TResource, TEvent>(
        master,
        windowStart,
        windowEnd,
      )
      if (occurrences.length === 0) return
      calendar.goToSpecificPeriod((occurrences[0]!.start as string).split('T')[0]!)
    }

    calendar.goToPreviousOccurrence = (eventId, fromDate) => {
      const master = resolveMasterEvent(eventId, internals._eventMap)
      if (!master?.recurrence) return

      const activeDateStr = fromDate
        ? toPlainDateTimeString(fromDate).split('T')[0]!
        : calendar.store.state.activeDate.toString({ calendarName: 'never' })
      const masterStartStr = (master.start as string).split('T')[0]!
      if (masterStartStr >= activeDateStr) return

      const occurrences = expandRecurringEvent<TResource, TEvent>(
        master,
        masterStartStr,
        activeDateStr,
      )
      const candidates = occurrences
        .map((occ) => (occ.start as string).split('T')[0]!)
        .filter((occDateStr) => occDateStr < activeDateStr)
      if (candidates.length === 0) return
      calendar.goToSpecificPeriod(candidates[candidates.length - 1]!)
    }
  },
}
