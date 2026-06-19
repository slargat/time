import { useCallback, useMemo } from 'react'
import { useStore } from '@tanstack/react-store'
import { buildEventAttributes } from '@tanstack/time'
import { useCalendarContext } from '../CalendarProvider/CalendarProvider'
import type { Event, EventAttributes, Resource } from '@tanstack/time'

export interface UseEventReturn<TEvent> {
  event: TEvent | null
  getEventProps: () => (EventAttributes & { key: string }) | null
}

/**
 * Subscribes to a single event by id. Re-resolves when the event set changes,
 * so a consumer of one event is not coupled to unrelated view state.
 */
export function useEvent<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(eventId: string): UseEventReturn<TEvent> {
  const { core } = useCalendarContext<TResource, TEvent>()

  const eventsVersion = useStore(core.store, (state) => state.eventsVersion)

  const event = useMemo(() => {
    void eventsVersion
    return core.getEvents().find((candidate) => candidate.id === eventId) ?? null
  }, [core, eventId, eventsVersion])

  const getEventProps = useCallback(() => {
    if (event === null) return null
    return { key: event.id, ...buildEventAttributes(event) }
  }, [event])

  return { event, getEventProps }
}
