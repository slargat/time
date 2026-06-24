export { useCalendar } from './useCalendar'
export type {
  ResizeState,
  ResizeOptions,
  UseCalendarOptions,
  UseCalendarReturn,
  ResizeHandleHandlers,
  ResizeHandleOptions,
  DayColumnProps,
} from './useCalendar'

export { CalendarProvider, useCalendarContext } from './CalendarProvider'
export type {
  CalendarContextValue,
  CalendarProviderProps,
} from './CalendarProvider'

export { useCalendarNavigation } from './useCalendarNavigation'
export type { UseCalendarNavigationReturn } from './useCalendarNavigation'

export { useMonthGrid } from './useMonthGrid'
export type {
  UseMonthGridOptions,
  UseMonthGridReturn,
  MonthDayProps,
  MonthEventProps,
} from './useMonthGrid'

export { useScheduleGrid } from './useScheduleGrid'
export type {
  UseScheduleGridOptions,
  UseScheduleGridReturn,
  ScheduleEventProps,
  ScheduleEventStyle,
  TimeSlotOptions,
} from './useScheduleGrid'

export { useEvent } from './useEvent'
export type { UseEventReturn } from './useEvent'

// Re-export structural prop builders + their types from core
export { buildDayCellAttributes, buildEventAttributes } from '@tanstack/time'
export type { DayCellAttributes, EventAttributes } from '@tanstack/time'

// Re-export ResizeError and AvailabilityConflict from core package
export type {
  ResizeError,
  AvailabilityConflict,
  UnavailabilityReason,
  SaveEventResult,
} from '@tanstack/time'

export {
  calculateGhostPreviewStyle,
  calculateSegmentResizePreview,
  calculateTimelineResizePreview,
  formatEventTimeRange,
  getEventDisplayTimeRange,
  getSegmentInfo,
  isMultiDayEvent,
} from '@tanstack/time'

export type {
  EventTimeRange,
  FormatEventTimeOptions,
  FormattedEventTime,
  GhostPreviewOptions,
  PositionStyle,
  ResizePreviewOptions,
  SegmentInfo,
  SegmentResizePreview,
  TimelineResizePreviewOptions,
  TimelineResizePreviewStyle,
} from '@tanstack/time'
