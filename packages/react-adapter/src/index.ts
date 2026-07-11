export { useCalendar } from './use-calendar'
export type {
  ReactCalendar,
  CalendarSubscribe,
  CalendarStateSelector,
} from './use-calendar'

export { createCalendarHook } from './create-calendar-hook'
export type {
  CreateCalendarHookOptions,
  AppCalendarOptions,
  AppReactCalendar,
} from './create-calendar-hook'

// Re-export the full @tanstack/time-core surface (feature-composition API,
// entity constructors, geometry helpers, types) so consumers have one import.

export * from '@tanstack/time-core'

// export * from './FlexRender'
export * from './Subscribe'
export * from './create-calendar-hook'
export * from './use-calendar'
