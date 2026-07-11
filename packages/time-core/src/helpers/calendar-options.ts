import type { CalendarFeatures } from '../types/calendar-features'
import type { CalendarOptions } from '../types/calendar'
import type { Event, Resource } from '../types'

/**
 * Identity helper for declaring calendar options with correct inference (v9
 * `tableOptions`). Use it statically, outside components.
 */
export function calendarOptions<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(
  options: CalendarOptions<TFeatures, TResource, TEvent>,
): CalendarOptions<TFeatures, TResource, TEvent> {
  return options
}
