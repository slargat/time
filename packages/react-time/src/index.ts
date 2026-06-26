export { useCalendar } from './useCalendar'
export type { ResizeState } from './useCalendar'

// Feature-composition API re-exported for convenience.
export {
  constructCalendar,
  coreCalendarFeature,
  eventsFeature,
  eventCrudFeature,
  resizeFeature,
  timelineFeature,
  recurrenceFeature,
  dependenciesFeature,
  lazyFetchFeature,
  historyFeature,
} from '@tanstack/time'
export type {
  Calendar,
  CalendarOptions,
  CalendarFeatures,
  CalendarFeature,
  DayNode,
  EventNode,
} from '@tanstack/time'

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
