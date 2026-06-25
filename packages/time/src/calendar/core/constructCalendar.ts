import { coreCalendarFeature } from './coreCalendarFeature'
import type { Event, Resource } from '../types'
import type { Calendar, CalendarOptions, Calendar_Internal } from '../types/Calendar'
import type { CalendarFeature, CalendarFeatures } from '../types/CalendarFeatures'

/**
 * Build a calendar instance from a set of opt-in features.
 *
 * Features are passed as an object (`features: { historyFeature, eventsFeature }`),
 * so the registered set is known to the type system without `as const`. APIs are
 * assigned once onto the singleton; node methods go on shared prototypes. The
 * returned instance is stable — the React/Solid layers subscribe to `store`
 * rather than re-creating callbacks each render.
 */
export function constructCalendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(options: CalendarOptions<TFeatures, TResource, TEvent>): Calendar<TFeatures, TResource, TEvent> {
  const features: Record<string, CalendarFeature> = {
    coreCalendarFeature,
    ...(options.features as unknown as Record<string, CalendarFeature>),
  }

  const calendar = {
    _features: features,
    _eventPrototype: {},
    _dayPrototype: {},
    options,
  } as unknown as Calendar_Internal<TFeatures, TResource, TEvent>

  const featureList = Object.values(features)

  // Table-level APIs. coreCalendarFeature is first, so the store/options it
  // sets up exist before any other feature's hook runs.
  for (const feature of featureList) {
    feature.constructCalendarApis?.(calendar)
  }

  // Shared node prototypes — one set of functions for every event/day node.
  for (const feature of featureList) {
    feature.assignEventPrototype?.(calendar._eventPrototype, calendar)
    feature.assignDayPrototype?.(calendar._dayPrototype, calendar)
  }

  return calendar as unknown as Calendar<TFeatures, TResource, TEvent>
}
