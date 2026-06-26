import type { Event, Resource } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'

/**
 * Add/edit/remove single events. Mutates the shared event map installed by
 * `eventsFeature` and checkpoints `historyFeature` (when registered) so the
 * change is undoable.
 *
 * ponytail: placement/availability validation and dependency propagation are
 * the timeline and dependencies features' jobs — this feature commits
 * unconditionally and returns success. Add the validation gate when those land.
 */
export const eventCrudFeature: CalendarFeature = {
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
      _propagateDependents?: (eventId: string) => void
    }

    calendar.addEvent = (event: TEvent) => {
      internals._pushHistory?.()
      internals._eventMap.set(event.id, internals._normalizeEvent(event))
      internals._bumpEvents()
      return Promise.resolve({ success: true })
    }

    calendar.editEvent = (
      eventId: string,
      updates: Partial<Omit<TEvent, 'id'>>,
    ) => {
      const existing = internals._eventMap.get(eventId)
      if (!existing) return Promise.resolve({ success: true })
      internals._pushHistory?.()
      internals._eventMap.set(
        eventId,
        internals._normalizeEvent({ ...existing, ...updates } as TEvent),
      )
      internals._propagateDependents?.(eventId)
      internals._bumpEvents()
      return Promise.resolve({ success: true })
    }

    calendar.removeEvent = (id: string) => {
      if (!internals._eventMap.has(id)) return
      internals._pushHistory?.()
      internals._eventMap.delete(id)
      internals._bumpEvents()
    }
  },
}
