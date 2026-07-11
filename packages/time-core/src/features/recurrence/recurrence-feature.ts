import { Temporal } from '@js-temporal/polyfill'
import { assignCalendarAPIs } from '../../utils'
import { calendar_dispatchWrite } from '../../pipeline/dispatch-write'
import { toPlainDateTimeString } from '../../date-utils'
import { expandRecurringEvent } from './expand-recurring-event'
import {
  compareRecurrenceInputToOccurrence,
  durationPreservingEnd,
  getRecurringOccurrence,
  makeSplitRecurringEventId,
  recurrenceInputMatchesOccurrence,
  resolveMasterEvent,
  resolveOccurrenceStart,
} from './recurrence'
import {
  normalizeRecurrenceDateTimeInputs,
  recurrence_expand,
  recurrence_materialize,
} from './recurrence-feature.utils'
import type { Calendar_Internal } from '../../types/calendar'
import type { CalendarFeature } from '../../types/calendar-features'
import type { WriteOp } from '../../pipeline/stages'
import type {
  Event,
  EventDateTimeInput,
  RecurrenceEditScope,
  SaveEventResult,
} from '../../types'
import './recurrence-feature.types'

type ScopeOptions = {
  scope: RecurrenceEditScope
  occurrenceStart?: EventDateTimeInput
}

/**
 * Recurring events (opt-in). Fills two kernel-ordered stages and adds the
 * scoped-editing + occurrence-navigation singleton APIs:
 * - `recurrenceExpand` (read): masters → in-window occurrences.
 * - `recurrenceMaterialize` (write): normalize a recurring master's rule on save.
 * - `editRecurringEvent` / `removeRecurringEvent` (`this`/`thisAndFollowing`/`all`).
 * - `goToNextOccurrence` / `goToPreviousOccurrence`.
 *
 * Edits never mutate the event map directly: each scope builds WriteOps and runs
 * them through `calendar_dispatchWrite` so validation stages still apply.
 *
 * ponytail: edits return a bare `{ success: true }` — availability conflicts are
 * already vetoed by the `availabilityValidate` write stage, so the richer
 * `SaveEventResult` (blocked reasons, attempted positions) is a later pass.
 */
export const recurrenceFeature: CalendarFeature = {
  projection: { recurrenceExpand: recurrence_expand },
  write: { recurrenceMaterialize: recurrence_materialize },

  constructCalendarApis: (calendar: Calendar_Internal<any, any, any>) => {
    const commit = (ops: Array<WriteOp>) => calendar_dispatchWrite(calendar, ops)
    const eventMap = () =>
      new Map(calendar.getEvents().map((event: Event) => [event.id, event]))

    const editRecurringEvent = (
      eventId: string,
      updates: Partial<Omit<Event, 'id'>> & Record<string, unknown>,
      options: ScopeOptions,
    ): Promise<SaveEventResult> => {
      const events = eventMap()
      const master = resolveMasterEvent(eventId, events)
      if (!master) return Promise.resolve({ success: true })

      // Whole-series edit (or a non-recurring event slipped in): patch the master.
      if (!master.recurrence || options.scope === 'all') {
        return Promise.resolve(
          commit([
            { kind: 'update', event: { ...master, ...updates, id: master.id } },
          ]),
        )
      }

      const occurrenceStart = resolveOccurrenceStart(master, options.occurrenceStart)
      const occurrence = getRecurringOccurrence(master, occurrenceStart)
      if (!occurrence) return Promise.resolve({ success: true })

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
            ? durationPreservingEnd(occurrenceStartStr, occurrenceEndStr, effectiveStart)
            : occurrenceEndStr

      const rule = normalizeRecurrenceDateTimeInputs(master.recurrence)
      const recurrenceUpdate = updates.recurrence
      const normalizedUpdates: Record<string, unknown> = {
        ...updates,
        ...(updates.start != null ? { start: effectiveStart } : {}),
        ...(updates.end != null || updates.start != null
          ? { end: effectiveEnd }
          : {}),
        ...(recurrenceUpdate != null
          ? { recurrence: normalizeRecurrenceDateTimeInputs(recurrenceUpdate) }
          : {}),
      }

      if (options.scope === 'this') {
        const exDates = (rule.exDates ?? []).filter(
          (value) => !recurrenceInputMatchesOccurrence(value, occurrenceStart),
        )
        const overrides = (rule.overrides ?? []).filter(
          (override) =>
            !recurrenceInputMatchesOccurrence(override.originalStart, occurrenceStart),
        )
        const overrideFields = { ...normalizedUpdates }
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
          recurrence: normalizeRecurrenceDateTimeInputs({ ...rule, exDates, overrides }),
        }
        return Promise.resolve(commit([{ kind: 'update', event: nextMaster }]))
      }

      // scope === 'thisAndFollowing': editing from the first occurrence is just
      // a whole-series edit; otherwise cap the master and split off a new series.
      if (occurrenceStart === toPlainDateTimeString(master.start)) {
        return Promise.resolve(
          commit([
            { kind: 'update', event: { ...master, ...updates, id: master.id } },
          ]),
        )
      }

      const splitDate = occurrenceStart.split('T')[0]!
      const oldRule = normalizeRecurrenceDateTimeInputs({ ...rule, until: splitDate })
      const remainingRule = normalizeRecurrenceDateTimeInputs({
        ...rule,
        ...(rule.count !== undefined && rule.until === undefined
          ? { count: Math.max(1, rule.count - (occurrence._occurrenceIndex ?? 0)) }
          : {}),
        exDates: rule.exDates?.filter(
          (value) => compareRecurrenceInputToOccurrence(value, occurrenceStart) > 0,
        ),
        overrides: rule.overrides?.filter(
          (override) =>
            compareRecurrenceInputToOccurrence(override.originalStart, occurrenceStart) > 0,
        ),
      })

      const updateFields = { ...normalizedUpdates }
      delete updateFields.recurrence

      const splitEvent = {
        ...occurrence,
        ...updateFields,
        id: makeSplitRecurringEventId(master, occurrenceStart, events),
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
      }

      const nextMaster = { ...master, recurrence: oldRule }
      return Promise.resolve(
        commit([
          { kind: 'update', event: nextMaster },
          { kind: 'create', event: splitEvent },
        ]),
      )
    }

    const removeRecurringEvent = (eventId: string, options: ScopeOptions): void => {
      const events = eventMap()
      const master = resolveMasterEvent(eventId, events)
      if (!master) return

      if (!master.recurrence || options.scope === 'all') {
        commit([{ kind: 'remove', event: master }])
        return
      }

      const occurrenceStart = resolveOccurrenceStart(master, options.occurrenceStart)
      const occurrence = getRecurringOccurrence(master, occurrenceStart)
      if (!occurrence) return

      const rule = normalizeRecurrenceDateTimeInputs(master.recurrence)

      if (options.scope === 'this') {
        const exDates = (rule.exDates ?? []).filter(
          (value) => !recurrenceInputMatchesOccurrence(value, occurrenceStart),
        )
        exDates.push(occurrenceStart)
        const overrides = (rule.overrides ?? []).filter(
          (override) =>
            !recurrenceInputMatchesOccurrence(override.originalStart, occurrenceStart),
        )
        const nextMaster = {
          ...master,
          recurrence: normalizeRecurrenceDateTimeInputs({ ...rule, exDates, overrides }),
        }
        commit([{ kind: 'update', event: nextMaster }])
        return
      }

      // thisAndFollowing: removing from the first occurrence removes the series.
      if (occurrenceStart === toPlainDateTimeString(master.start)) {
        commit([{ kind: 'remove', event: master }])
        return
      }

      const nextMaster = {
        ...master,
        recurrence: normalizeRecurrenceDateTimeInputs({
          ...rule,
          until: occurrenceStart.split('T')[0]!,
        }),
      }
      commit([{ kind: 'update', event: nextMaster }])
    }

    const goToNextOccurrence = (
      eventId: string,
      fromDate?: EventDateTimeInput,
    ): void => {
      const master = resolveMasterEvent(eventId, eventMap())
      if (!master?.recurrence) return

      const baseDate = fromDate
        ? Temporal.PlainDate.from(toPlainDateTimeString(fromDate).split('T')[0]!)
        : calendar.store.state.activeDate
      const windowStart = baseDate.add({ days: 1 }).toString({ calendarName: 'never' })
      const windowEnd = baseDate.add({ years: 4 }).toString({ calendarName: 'never' })

      const occurrences = expandRecurringEvent(master, windowStart, windowEnd)
      if (occurrences.length === 0) return
      calendar.goToSpecificPeriod(
        toPlainDateTimeString(occurrences[0]!.start).split('T')[0]!,
      )
    }

    const goToPreviousOccurrence = (
      eventId: string,
      fromDate?: EventDateTimeInput,
    ): void => {
      const master = resolveMasterEvent(eventId, eventMap())
      if (!master?.recurrence) return

      const activeDateStr = fromDate
        ? toPlainDateTimeString(fromDate).split('T')[0]!
        : calendar.store.state.activeDate.toString({ calendarName: 'never' })
      const masterStartStr = toPlainDateTimeString(master.start).split('T')[0]!
      if (masterStartStr >= activeDateStr) return

      const occurrences = expandRecurringEvent(master, masterStartStr, activeDateStr)
      const candidates = occurrences
        .map((occ) => toPlainDateTimeString(occ.start).split('T')[0]!)
        .filter((occDateStr) => occDateStr < activeDateStr)
      if (candidates.length === 0) return
      calendar.goToSpecificPeriod(candidates[candidates.length - 1]!)
    }

    assignCalendarAPIs('recurrenceFeature', calendar, {
      calendar_editRecurringEvent: { fn: editRecurringEvent },
      calendar_removeRecurringEvent: { fn: removeRecurringEvent },
      calendar_goToNextOccurrence: { fn: goToNextOccurrence },
      calendar_goToPreviousOccurrence: { fn: goToPreviousOccurrence },
    })
  },
}
