import { Temporal } from '@js-temporal/polyfill'
import { toPlainDateTimeString } from '../../date-utils'
import type { Event, EventDateTimeInput, Resource } from '../../types'

/**
 * Expand a single recurring master event into occurrence instances that fall
 * within the viewport window [windowStart, windowEnd). Salvaged verbatim from
 * `@tanstack/time`'s `expandRecurringEvent` (ADR 0007: copied in, self-contained).
 *
 * - The master occurrence (index 0) is returned when visible so EXDATE/overrides
 *   can affect the first instance too.
 * - Stable ids: master id for index 0, `"{masterId}_{n}"` for n >= 1, unless an
 *   override supplies `id`.
 * - Each occurrence carries `_recurringMasterId`, `_occurrenceIndex`,
 *   `_occurrenceOriginalStart`. Occurrences are ephemeral (never stored).
 */
export function expandRecurringEvent<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(event: TEvent, windowStart: string, windowEnd: string): Array<TEvent> {
  const rule = (event as Event<TResource>).recurrence
  if (!rule) return []

  const masterStartStr = toPlainDateTimeString(event.start)
  const masterEndStr = toPlainDateTimeString(event.end)

  const masterStart = Temporal.PlainDateTime.from(masterStartStr)
  const masterEnd = Temporal.PlainDateTime.from(masterEndStr)

  const durationMs = masterStart
    .toZonedDateTime('UTC')
    .until(masterEnd.toZonedDateTime('UTC'))
    .total('milliseconds')

  const interval = Math.max(1, rule.interval ?? 1)
  const windowStartDate = Temporal.PlainDate.from(windowStart)
  const windowEndDate = Temporal.PlainDate.from(windowEnd)
  const untilDate = rule.until ? Temporal.PlainDate.from(rule.until) : null
  const frequency = rule.frequency

  const byWeekday =
    frequency === 'weekly'
      ? (rule.byWeekday?.length ? rule.byWeekday : [masterStart.dayOfWeek])
          .filter((day) => day >= 1 && day <= 7)
          .filter((day, index, all) => all.indexOf(day) === index)
          .sort((a, b) => a - b)
      : null

  const exDateTimes = new Set<string>()
  const exDates = new Set<string>()
  for (const exDate of rule.exDates ?? []) {
    if (typeof exDate === 'string' && !exDate.includes('T')) {
      exDates.add(
        Temporal.PlainDate.from(exDate).toString({ calendarName: 'never' }),
      )
    } else {
      const normalized = toPlainDateTimeString(exDate)
      exDateTimes.add(normalized)
      exDates.add(
        Temporal.PlainDateTime.from(normalized)
          .toPlainDate()
          .toString({ calendarName: 'never' }),
      )
    }
  }

  const overridesByDateTime = new Map<
    string,
    NonNullable<typeof rule.overrides>[number]
  >()
  const overridesByDate = new Map<
    string,
    NonNullable<typeof rule.overrides>[number]
  >()
  for (const override of rule.overrides ?? []) {
    const originalStart = override.originalStart
    if (typeof originalStart === 'string' && !originalStart.includes('T')) {
      overridesByDate.set(
        Temporal.PlainDate.from(originalStart).toString({
          calendarName: 'never',
        }),
        override,
      )
    } else {
      const normalized = toPlainDateTimeString(originalStart)
      overridesByDateTime.set(normalized, override)
      overridesByDate.set(
        Temporal.PlainDateTime.from(normalized)
          .toPlainDate()
          .toString({ calendarName: 'never' }),
        override,
      )
    }
  }

  const occurrences: Array<TEvent> = []
  let occurrenceIndex = 0
  let step = 0
  const MAX_STEPS = 3650
  // Bounded margin (~2 months) for how far an override may shift an occurrence's
  // start relative to its original date, used for both the seek-back target and
  // the look-ahead termination margin.
  const LOOK_AHEAD_DAYS = 62

  // Seek: a long old series (e.g. daily from 2010 viewed in 2035) would burn all
  // MAX_STEPS before reaching the window and silently truncate. Jump `step` to
  // just before the window instead of always starting at 0.
  // Only when count is undefined: occurrenceIndex drives ids AND the count limit,
  // and for these single-candidate frequencies index === step, so seeking keeps
  // ids correct. Weekly is skipped (multiple candidates per step break that).
  if (rule.count === undefined) {
    const masterStartDate = masterStart.toPlainDate()
    const seekTarget = windowStartDate.subtract({ days: LOOK_AHEAD_DAYS })
    if (Temporal.PlainDate.compare(masterStartDate, seekTarget) < 0) {
      let startStep = 0
      switch (frequency) {
        case 'daily':
          startStep = Math.floor(
            masterStartDate.until(seekTarget, { largestUnit: 'days' }).days /
              interval,
          )
          break
        case 'monthly':
          startStep = Math.floor(
            ((seekTarget.year - masterStartDate.year) * 12 +
              (seekTarget.month - masterStartDate.month)) /
              interval,
          )
          break
        case 'yearly':
          startStep = Math.floor(
            (seekTarget.year - masterStartDate.year) / interval,
          )
          break
        // weekly / default: no seek (occurrenceIndex !== step)
      }
      if (startStep > 0) {
        step = startStep
        occurrenceIndex = startStep
      }
    }
  }

  // MAX_STEPS is a budget of iterations from wherever we start (0, or the seek
  // target), not an absolute step ceiling — otherwise a seek past MAX_STEPS would
  // skip the loop entirely.
  const maxStep = step + MAX_STEPS

  const masterMonday = masterStart
    .toPlainDate()
    .subtract({ days: masterStart.dayOfWeek - 1 })

  const toDateTimeOnMasterTime = (date: Temporal.PlainDate) =>
    Temporal.PlainDateTime.from({
      year: date.year,
      month: date.month,
      day: date.day,
      hour: masterStart.hour,
      minute: masterStart.minute,
      second: masterStart.second,
    })

  const addDuration = (start: string) =>
    Temporal.PlainDateTime.from(start)
      .toZonedDateTime('UTC')
      .add({ milliseconds: durationMs })
      .toPlainDateTime()
      .toString({ smallestUnit: 'second' })

  while (step <= maxStep) {
    const candidates: Array<Temporal.PlainDateTime> = []

    switch (frequency) {
      case 'daily':
        candidates.push(masterStart.add({ days: step * interval }))
        break
      case 'weekly': {
        const targetMonday = masterMonday.add({ weeks: step * interval })
        if (step === 0) candidates.push(masterStart)
        for (const targetWeekday of byWeekday ?? [masterStart.dayOfWeek]) {
          const targetDate = targetMonday.add({ days: targetWeekday - 1 })
          candidates.push(toDateTimeOnMasterTime(targetDate))
        }
        break
      }
      case 'monthly':
        candidates.push(addSafeMonths(masterStart, step * interval))
        break
      case 'yearly':
        candidates.push(addSafeMonths(masterStart, step * interval * 12))
        break
      default:
        candidates.push(masterStart.add({ days: step * interval }))
        break
    }

    const uniqueCandidates = Array.from(
      new Map(
        candidates
          .filter(
            (candidate) =>
              Temporal.PlainDateTime.compare(candidate, masterStart) >= 0,
          )
          .sort(Temporal.PlainDateTime.compare)
          .map((candidate) => [
            candidate.toString({ smallestUnit: 'second' }),
            candidate,
          ]),
      ).values(),
    )

    for (const candidateStart of uniqueCandidates) {
      const candidateDate = candidateStart.toPlainDate()
      const candidateDateStr = candidateDate.toString({ calendarName: 'never' })

      // `until` is inclusive (RFC 5545): an occurrence exactly on `until` is
      // emitted, so terminate only when strictly after it.
      if (
        untilDate &&
        Temporal.PlainDate.compare(candidateDate, untilDate) > 0
      ) {
        return occurrences
      }

      if (
        !untilDate &&
        rule.count !== undefined &&
        occurrenceIndex >= rule.count
      ) {
        return occurrences
      }

      const originalStartStr = candidateStart.toString({
        smallestUnit: 'second',
      })
      const originalEndStr = addDuration(originalStartStr)
      const override =
        overridesByDateTime.get(originalStartStr) ??
        overridesByDate.get(candidateDateStr)

      const excluded =
        exDateTimes.has(originalStartStr) || exDates.has(candidateDateStr)

      if (!excluded) {
        const generatedId =
          occurrenceIndex === 0 ? event.id : `${event.id}_${occurrenceIndex}`
        const overrideStart = override?.start as EventDateTimeInput | undefined
        const overrideEnd = override?.end as EventDateTimeInput | undefined
        const occurrenceStartStr =
          overrideStart != null
            ? toPlainDateTimeString(overrideStart)
            : originalStartStr
        const occurrenceEndStr =
          overrideEnd != null
            ? toPlainDateTimeString(overrideEnd)
            : overrideStart != null
              ? addDuration(occurrenceStartStr)
              : originalEndStr

        const occurrenceDate = Temporal.PlainDateTime.from(occurrenceStartStr)
          .toPlainDate()
          .toString({ calendarName: 'never' })

        if (
          occurrenceDate >=
            windowStartDate.toString({ calendarName: 'never' }) &&
          occurrenceDate < windowEndDate.toString({ calendarName: 'never' })
        ) {
          const overrideFields = override
            ? ({ ...override } as Record<string, unknown>)
            : {}
          delete overrideFields.originalStart
          delete overrideFields.id
          delete overrideFields.start
          delete overrideFields.end

          occurrences.push({
            ...event,
            ...overrideFields,
            id: (override?.id ?? generatedId) as TEvent['id'],
            start: occurrenceStartStr,
            end: occurrenceEndStr,
            _recurringMasterId: event.id,
            _occurrenceIndex: occurrenceIndex,
            _occurrenceOriginalStart: originalStartStr,
            _originalStart: undefined,
            _originalEnd: undefined,
          } as unknown as TEvent)
        }
      }

      occurrenceIndex++

      // Keep stepping past windowEnd by a bounded margin: an override can move a
      // later occurrence's `start` back into the window. The push-filter above
      // still gates on the final in-window date, so this only widens the search.
      if (
        Temporal.PlainDate.compare(
          candidateDate,
          windowEndDate.add({ days: LOOK_AHEAD_DAYS }),
        ) > 0
      ) {
        return occurrences
      }
    }

    step++
  }

  return occurrences
}

/**
 * Add N months to a PlainDateTime, clamping the day-of-month to the last valid
 * day of the resulting month (e.g. Jan 31 + 1 month → Feb 28/29).
 */
function addSafeMonths(
  dt: Temporal.PlainDateTime,
  months: number,
): Temporal.PlainDateTime {
  let year = dt.year
  let month = dt.month + months

  year += Math.floor((month - 1) / 12)
  month = ((month - 1) % 12) + 1

  const daysInMonth = Temporal.PlainDate.from({ year, month, day: 1 }).daysInMonth
  const day = Math.min(dt.day, daysInMonth)

  return Temporal.PlainDateTime.from({
    year,
    month,
    day,
    hour: dt.hour,
    minute: dt.minute,
    second: dt.second,
  })
}
