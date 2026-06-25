import { Temporal } from '@js-temporal/polyfill'
import { expandRecurringEvent } from './expandRecurringEvent'
import type { Event, EventDateTimeInput, Resource } from './types'
import { toPlainDateTimeString } from '~/date/parse'

/**
 * Recurrence helpers, extracted from `CalendarCore` so the class and the
 * feature-composed instance share one implementation. Pure except where an
 * event map is passed in for id resolution.
 */

export function normalizeRecurrenceDateTimeInputs<
  TRule extends NonNullable<Event['recurrence']>,
>(rule: TRule): TRule {
  return {
    ...rule,
    exDates: rule.exDates?.map((value) =>
      typeof value === 'string' && !value.includes('T')
        ? value
        : toPlainDateTimeString(value),
    ),
    overrides: rule.overrides?.map((override) => ({
      ...override,
      originalStart:
        typeof override.originalStart === 'string' &&
        !override.originalStart.includes('T')
          ? override.originalStart
          : toPlainDateTimeString(override.originalStart),
      ...(override.start != null
        ? { start: toPlainDateTimeString(override.start) }
        : {}),
      ...(override.end != null
        ? { end: toPlainDateTimeString(override.end) }
        : {}),
    })),
  }
}

export function resolveMasterEvent<TEvent extends Event>(
  eventId: string,
  eventMap: Map<string, TEvent>,
): TEvent | undefined {
  const direct = eventMap.get(eventId)
  if (direct) return direct
  const match = eventId.match(/^(.+)_\d+$/)
  if (match) return eventMap.get(match[1]!)
  return undefined
}

export function resolveOccurrenceStart<TEvent extends Event>(
  master: TEvent,
  occurrenceStart?: EventDateTimeInput,
): string {
  return occurrenceStart != null
    ? toPlainDateTimeString(occurrenceStart)
    : toPlainDateTimeString(master.start)
}

export function recurrenceInputMatchesOccurrence(
  value: EventDateTimeInput,
  occurrenceStart: string,
): boolean {
  if (typeof value === 'string' && !value.includes('T')) {
    return (
      Temporal.PlainDate.from(value).toString({ calendarName: 'never' }) ===
      occurrenceStart.split('T')[0]
    )
  }
  return toPlainDateTimeString(value) === occurrenceStart
}

export function compareRecurrenceInputToOccurrence(
  value: EventDateTimeInput,
  occurrenceStart: string,
): number {
  if (typeof value === 'string' && !value.includes('T')) {
    return Temporal.PlainDate.compare(
      Temporal.PlainDate.from(value),
      Temporal.PlainDate.from(occurrenceStart.split('T')[0]!),
    )
  }
  return Temporal.PlainDateTime.compare(
    Temporal.PlainDateTime.from(toPlainDateTimeString(value)),
    Temporal.PlainDateTime.from(occurrenceStart),
  )
}

export function durationPreservingEnd(
  originalStart: string,
  originalEnd: string,
  nextStart: string,
): string {
  const durationMs = Temporal.PlainDateTime.from(originalStart)
    .toZonedDateTime('UTC')
    .until(Temporal.PlainDateTime.from(originalEnd).toZonedDateTime('UTC'))
    .total('milliseconds')
  return Temporal.PlainDateTime.from(nextStart)
    .toZonedDateTime('UTC')
    .add({ milliseconds: durationMs })
    .toPlainDateTime()
    .toString({ smallestUnit: 'second' })
}

export function getRecurringOccurrence<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(master: TEvent, occurrenceStart: string): TEvent | null {
  const occurrenceDate = occurrenceStart.split('T')[0]!
  let windowStart = occurrenceDate
  let windowEnd = Temporal.PlainDate.from(occurrenceDate)
    .add({ days: 1 })
    .toString({ calendarName: 'never' })

  const override = master.recurrence?.overrides?.find((candidate) =>
    recurrenceInputMatchesOccurrence(candidate.originalStart, occurrenceStart),
  )
  if (override?.start != null) {
    const overrideDate = toPlainDateTimeString(override.start).split('T')[0]!
    windowStart = overrideDate < occurrenceDate ? overrideDate : occurrenceDate
    const maxDate = overrideDate > occurrenceDate ? overrideDate : occurrenceDate
    windowEnd = Temporal.PlainDate.from(maxDate)
      .add({ days: 1 })
      .toString({ calendarName: 'never' })
  }

  const occurrences = expandRecurringEvent<TResource, TEvent>(
    master,
    windowStart,
    windowEnd,
  )
  return (
    occurrences.find(
      (occ) =>
        (occ._occurrenceOriginalStart ?? occ.start) === occurrenceStart,
    ) ?? null
  )
}

export function makeSplitRecurringEventId<TEvent extends Event>(
  master: TEvent,
  occurrenceStart: string,
  eventMap: Map<string, TEvent>,
): string {
  const safeStart = occurrenceStart.replace(/[^0-9A-Za-z]/g, '')
  let id = `${master.id}_${safeStart}`
  let suffix = 1
  while (eventMap.has(id)) {
    id = `${master.id}_${safeStart}_${suffix}`
    suffix++
  }
  return id
}
