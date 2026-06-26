export * from './types'
export * from './splitMultiDayEvents'
export * from './generateDateRange'
export * from './getEventProps'
export * from './groupDaysBy'
export * from './getTimeSlots'
export * from './getResizeProps'
export * from './resizeController'
export * from './calendar'

// Feature-composition API (TanStack Table v9-style)
export { constructCalendar } from './core/constructCalendar'
export type {
  Calendar,
  Calendar_Core,
  Calendar_Internal,
  CalendarOptions,
  DayNode,
  EventNode,
} from './types/Calendar'
export type {
  CalendarFeature,
  CalendarFeatures,
  CoreCalendarFeatures,
  StockCalendarFeatures,
  Plugins,
} from './types/CalendarFeatures'

export { coreCalendarFeature } from './core/coreCalendarFeature'
export { eventsFeature } from './features/eventsFeature'
export { eventCrudFeature } from './features/eventCrudFeature'
export { resizeFeature } from './features/resizeFeature'
export { timelineFeature } from './features/timelineFeature'
export { recurrenceFeature } from './features/recurrenceFeature'
export { dependenciesFeature } from './features/dependenciesFeature'
export { lazyFetchFeature } from './features/lazyFetchFeature'
export { historyFeature } from './features/historyFeature'

export type { Calendar_Events, EventProps } from './features/eventsFeature.types'
export type { Calendar_Crud } from './features/eventCrudFeature.types'
export type {
  Calendar_Resize,
  EventNode_Resize,
  DayNode_Resize,
} from './features/resizeFeature.types'
export type { Calendar_Timeline } from './features/timelineFeature.types'
export type { Calendar_Recurrence } from './features/recurrenceFeature.types'
export type { Calendar_Dependencies } from './features/dependenciesFeature.types'
export type { Calendar_LazyFetch } from './features/lazyFetchFeature.types'
export type { Calendar_History } from './features/historyFeature.types'
