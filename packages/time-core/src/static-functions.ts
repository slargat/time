/**
 * Standalone, tree-shakeable static functions, re-exported from each feature's
 * `.utils.ts` (v9 `static-functions.ts`). Consumers can call the namespaced
 * `calendar_*` / `day_*` / `event_*` fns without constructing a calendar, and
 * features reach each other through these instead of untyped internals.
 */

// Core
export * from './core/calendar/core-calendar-feature.utils'
export * from './core/days/core-days-feature.utils'
export * from './core/events/core-events-feature.utils'
export * from './core/projection/core-projection-feature.utils'
export * from './core/view-models/core-view-models-feature.utils'

// Features
export * from './features/dependencies/dependencies-feature.utils'
export * from './features/lazy-fetch/lazy-fetch-feature.utils'
export * from './features/month-view/month-view-feature.utils'
export * from './features/recurrence/expand-recurring-event'
export * from './features/recurrence/recurrence-feature.utils'
export * from './features/resize/get-resize-props'
export * from './features/timeline/availability'
export * from './features/timeline/availability-feature.utils'
