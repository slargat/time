import { availabilityFeature } from './timeline/availability-feature'
import { dependenciesFeature } from './dependencies/dependencies-feature'
import { eventCrudFeature } from './event-crud/event-crud-feature'
import { lazyFetchFeature } from './lazy-fetch/lazy-fetch-feature'
import { monthViewFeature } from './month-view/month-view-feature'
import { recurrenceFeature } from './recurrence/recurrence-feature'
import { resizeFeature } from './resize/resize-feature'
import { timeGridViewFeature } from './time-grid-view/time-grid-view-feature'
import { timelineViewFeature } from './timeline-view/timeline-view-feature'
import type { CalendarFeature } from '../types/calendar-features'

/**
 * Opt-in features shipped with `@tanstack/time-core` (v9 `stockFeatures`).
 * Behavior features and View features share this one registry. Grows as features
 * land (week/timeGrid view, timeline view, agenda view, resize, recurrence, …).
 */
export const stockFeatures = {
  availabilityFeature,
  dependenciesFeature,
  eventCrudFeature,
  lazyFetchFeature,
  monthViewFeature,
  recurrenceFeature,
  resizeFeature,
  timeGridViewFeature,
  timelineViewFeature,
} satisfies Record<string, CalendarFeature>
