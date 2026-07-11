import { Temporal } from '@js-temporal/polyfill'
import { toPlainDateTimeString } from '../../date-utils'
import { expandRecurringEvent } from './expand-recurring-event'
import type { Event, EventDateTimeInput, Resource } from '../../types'

/**
 * Pure recurrence helpers for scoped occurrence editing, salvaged from
 * `@tanstack/time`'s `recurrence.ts`. Pure except where an event map is passed
 * in for id resolution. `normalizeRecurrenceDateTimeInputs` lives in
 * `recurrence-feature.utils.ts` (shared with the materialize stage) — not
 * duplicated here.
 */

/** Resolve an occurrence id (`"{masterId}_{n}"`) back to its stored master. */
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

/** The occurrence start to act on, defaulting to the master's own start. */
export function resolveOccurrenceStart<TEvent extends Event>(
  master: TEvent,
  occurrenceStart?: EventDateTimeInput,
): string {
  return occurrenceStart != null
    ? toPlainDateTimeString(occurrenceStart)
    : toPlainDateTimeString(master.start)
}

/** Does a date(-time) input refer to the same occurrence as `occurrenceStart`? */
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

/** Order a date(-time) input against `occurrenceStart` (-1 / 0 / 1). */
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

/** A new end that preserves the original duration when the start moves. */
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

/** Expand just the single occurrence at `occurrenceStart`, or null. */
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
    const overrideDate = toPlainDateTimeString(
      override.start as EventDateTimeInput,
    ).split('T')[0]!
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
      (occ) => (occ._occurrenceOriginalStart ?? occ.start) === occurrenceStart,
    ) ?? null
  )
}

/** A collision-free id for a split (`thisAndFollowing`) series. */
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
