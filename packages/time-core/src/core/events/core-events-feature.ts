import { assignCalendarAPIs, makeCalendarStateUpdater } from '../../utils'
import {
  calendar_getEvents,
  calendar_setEvents,
  writeEventsAtom,
} from './core-events-feature.utils'
import { normalizeEvents } from './normalize-event'
import type { CalendarFeature } from '../../types/calendar-features'
import type { Event } from '../../types'

/**
 * The Event entity feature. Owns the event collection — held as the `events`
 * store slice (so projection memos invalidate on the array ref) — and exposes
 * `getEvents`/`setEvents`.
 *
 * Ownership is v9 `data`-style dual controlled/uncontrolled: `options.events`
 * seeds the slice; internal mutations replace it (and notify `onEventsChange`); a
 * controlled consumer re-feeds a fresh `options.events` each render, re-synced by
 * `setOptions`. Every entry point normalizes to wall-time strings (`normalizeEvent`).
 */
export const coreEventsFeature: CalendarFeature = {
  getInitialState: (state) => ({ events: [], ...state }),

  getDefaultOptions: (calendar) => ({
    onEventsChange: makeCalendarStateUpdater('events', calendar),
  }),

  constructCalendarApis: (calendar) => {
    // Seed the atom directly (not via onEventsChange) so seeding doesn't fire the
    // consumer's persist callback at construction. Record the synced ref so the
    // first `setOptions` (same ref) is a no-op.
    const timeZone = calendar.options.timeZone ?? 'UTC'
    writeEventsAtom(
      calendar,
      normalizeEvents((calendar.options.events ?? []) as Array<Event>, timeZone),
    )
    calendar._syncedEventsRef = calendar.options.events

    assignCalendarAPIs('coreEvents', calendar, {
      calendar_getEvents: { fn: () => calendar_getEvents(calendar) },
      calendar_setEvents: {
        fn: (events: Array<Event>) => calendar_setEvents(calendar, events),
      },
    })
  },
}
