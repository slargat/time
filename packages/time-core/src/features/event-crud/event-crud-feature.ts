import { assignCalendarAPIs } from '../../utils'
import { calendar_dispatchWrite } from '../../pipeline/dispatch-write'
import { eventCrud_commit } from './event-crud-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'
import './event-crud-feature.types'

/**
 * Add/edit/remove single events (opt-in, v9-style). Public mutations build a
 * one-op batch and run it through the write pipeline; the feature owns the
 * `commit` stage. Validation (availability) and cascades (dependencies) are other
 * features filling other write stages — this feature stays unaware of them, the
 * kernel orders them.
 */
export const eventCrudFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    assignCalendarAPIs('eventCrudFeature', calendar, {
      calendar_createEvent: {
        fn: (event) =>
          Promise.resolve(
            calendar_dispatchWrite(calendar, [{ kind: 'create', event }]),
          ),
      },
      calendar_updateEvent: {
        fn: (id: string, updates: Record<string, unknown>) => {
          const existing = calendar
            .getEvents()
            .find((event: any) => event.id === id)
          if (!existing) return Promise.resolve({ success: true } as const)
          return Promise.resolve(
            calendar_dispatchWrite(calendar, [
              { kind: 'update', event: { ...existing, ...updates, id } },
            ]),
          )
        },
      },
      calendar_removeEvent: {
        fn: (id: string) => {
          const existing = calendar
            .getEvents()
            .find((event: any) => event.id === id)
          if (!existing) return Promise.resolve({ success: true } as const)
          return Promise.resolve(
            calendar_dispatchWrite(calendar, [
              { kind: 'remove', event: existing },
            ]),
          )
        },
      },
    })
  },

  // Single owner of the `commit` write stage (ADR 0001/0007).
  write: {
    commit: eventCrud_commit,
  },
}
