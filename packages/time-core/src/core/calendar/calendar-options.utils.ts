import { functionalUpdate } from '../../utils'
import { writeEventsAtom } from '../events/core-events-feature.utils'
import { normalizeEvents } from '../events/normalize-event'
import type { Updater } from '../../utils'
import type { CalendarOptions, Calendar_Internal } from '../../types/calendar'
import type { Event } from '../../types'

/**
 * Reflect externally controlled `options.state` slices into the base atoms
 * (v9 `table_syncExternalStateToBaseAtoms`). Keeps derived atoms, the store, and
 * APIs reading a consistent snapshot when a slice is driven from outside (e.g. a
 * React `useState`). Only writes when the value actually changed, to avoid
 * needless notifications.
 */
export function calendar_syncExternalStateToBaseAtoms(
  calendar: Calendar_Internal<any, any, any>,
): void {
  const state = calendar.options.state
  if (!state) return

  calendar._reactivity.batch(() => {
    for (const key in state) {
      const baseAtom = (calendar.baseAtoms as Record<string, any>)[key]
      if (!baseAtom) continue
      const externalState = (state as Record<string, unknown>)[key]
      if (externalState !== baseAtom.get()) {
        baseAtom.set(() => externalState)
      }
    }
  })
}

/**
 * Merge new options over the current resolved options (v9 `table_mergeOptions`).
 * `options.mergeOptions` owns the merge when provided; otherwise a shallow merge.
 */
export function calendar_mergeOptions(
  calendar: Calendar_Internal<any, any, any>,
  newOptions: CalendarOptions<any, any, any>,
): CalendarOptions<any, any, any> {
  if (!calendar.options.mergeOptions) {
    return { ...calendar.options, ...newOptions }
  }
  return calendar.options.mergeOptions(calendar.options, newOptions)
}

/**
 * Update the instance options and re-sync controlled state (v9
 * `table_setOptions`). The updater receives the current resolved options.
 */
export function calendar_setOptions(
  calendar: Calendar_Internal<any, any, any>,
  updater: Updater<CalendarOptions<any, any, any>>,
): void {
  const prevResources = calendar.options.resources
  const newOptions = functionalUpdate(updater, calendar.options)
  calendar.options = calendar_mergeOptions(calendar, newOptions)
  calendar_syncExternalStateToBaseAtoms(calendar)

  // Events use the v9 `data` channel: re-sync into the atom only when the
  // consumer feeds a *new* `options.events` reference (controlled re-feed). A
  // stable ref (uncontrolled) is a no-op, so internal mutations aren't clobbered.
  if (calendar.options.events !== calendar._syncedEventsRef) {
    calendar._syncedEventsRef = calendar.options.events
    const timeZone = calendar.options.timeZone ?? 'UTC'
    writeEventsAtom(
      calendar,
      normalizeEvents((calendar.options.events ?? []) as Array<Event>, timeZone),
    )
  }

  // Availability caches are keyed by resource×weekday and outlive memo recomputes;
  // drop them when the resource set changes (the feature installs the reset hook).
  if (calendar.options.resources !== prevResources) {
    ;(calendar._resetAvailabilityCaches as (() => void) | undefined)?.()
  }
}
