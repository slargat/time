import type { SegmentInfo } from '../getResizeProps'
import type { Day, Event, Resource, TimeSlot } from '../types'

/** Node methods `eventsFeature` adds to every event node. */
export interface EventNode_Events<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  /** Positioning props for this event (overlap/lane layout). */
  getProps: () => EventProps<TEvent>
  /** Split/occurrence metadata for this event. */
  getSegmentInfo: () => SegmentInfo
}

/** Positioning props for a single event (month vs time-grid). */
export interface EventProps<TEvent extends Event = Event> {
  isSplitEvent: boolean
  overlappingEvents: Array<TEvent>
  start: string
  end: string
  style?: {
    top: string
    height: string
    left: string
    width: string
  }
}

/** API contributed by `eventsFeature` — the event data + derivation layer. */
export interface Calendar_Events<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  /** Replace the entire event set. */
  setEvents: (events: Array<TEvent> | null) => void
  /** Snapshot of all events currently held (including outside the visible range). */
  getEvents: () => Array<TEvent>
  /** Timed + all-day events occurring on a given ISO date (YYYY-MM-DD). */
  getEventsByDate: (date: string) => Array<TEvent>
  /** All-day events occurring on a given ISO date (multi-day segments included). */
  getAllDayEventsByDate: (date: string) => Array<TEvent>
  /** Day objects for an arbitrary inclusive range, derived from current state. */
  getDaysInRange: (start: string, end: string) => Array<Day<TResource, TEvent>>
  /** The master event for an occurrence (or the event itself). */
  getMasterEvent: (event: TEvent) => TEvent
  /** Split/occurrence metadata for an event. */
  getEventSegmentInfo: (event: TEvent) => SegmentInfo
  /** Positioning props (overlap/lane layout) for an event. */
  getEventProps: (event: TEvent) => EventProps<TEvent>
  /** Group a flat day list into week/workWeek rows. */
  groupDaysBy: (props: {
    days: Array<Day<TResource, TEvent> | null>
    unit: 'week' | 'workWeek'
    fillMissingDays?: boolean
  }) => Array<Array<Day<TResource, TEvent> | null>>
  /** Time-axis slots for day/week views. */
  getTimeSlots: (options?: {
    startHour?: number
    endHour?: number
    interval?: number
  }) => Array<TimeSlot>
}
