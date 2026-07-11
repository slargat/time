// ── construction ─────────────────────────────────────────────────────────────
export { constructCalendar } from './core/calendar/construct-calendar'
export { coreFeatures } from './core/core-features'
export { stockFeatures } from './features/stock-features'

// ── helpers ──────────────────────────────────────────────────────────────────
export { calendarFeatures } from './helpers/calendar-features'
export { calendarOptions } from './helpers/calendar-options'
// Apply an `OnChangeFn` updater (value or `(old) => new`) in a controlled handler.
export { functionalUpdate, makeCalendarStateUpdater } from './utils'
export type { Updater } from './utils'
export type { OnChangeFn } from './types/type-utils'

// ── features (each a CalendarFeature; Views carry a `view` descriptor) ────────
export { availabilityFeature } from './features/timeline/availability-feature'
export { dependenciesFeature } from './features/dependencies/dependencies-feature'
export { eventCrudFeature } from './features/event-crud/event-crud-feature'
export { lazyFetchFeature } from './features/lazy-fetch/lazy-fetch-feature'
export { monthViewFeature } from './features/month-view/month-view-feature'
export { recurrenceFeature } from './features/recurrence/recurrence-feature'
export { resizeFeature } from './features/resize/resize-feature'
export { timeGridViewFeature } from './features/time-grid-view/time-grid-view-feature'
export { timelineViewFeature } from './features/timeline-view/timeline-view-feature'

// ── entity constructors ──────────────────────────────────────────────────────
export { constructDay } from './core/days/construct-day'
export { constructEvent } from './core/events/construct-event'

// ── reactivity ───────────────────────────────────────────────────────────────
export { storeReactivityBindings } from './store-reactivity-bindings'
export * from './reactivity'

// ── pipelines (ADR 0001/0007) ────────────────────────────────────────────────
export * from './pipeline/stages'
export { calendar_dispatchWrite } from './pipeline/dispatch-write'

// ── types ────────────────────────────────────────────────────────────────────
export type * from './types'
export type * from './types/calendar'
export type * from './types/calendar-features'
export type * from './types/view-model'
export type {
  MonthViewModel,
  Week,
} from './features/month-view/month-view-feature.types'
export type {
  TimelineLane,
  TimelineViewModel,
} from './features/timeline-view/timeline-view-feature.types'
export type { TimeGridViewModel } from './features/time-grid-view/time-grid-view-feature.types'
export type {
  EventProps,
  EventStyle,
} from './features/time-grid-view/get-event-props'
