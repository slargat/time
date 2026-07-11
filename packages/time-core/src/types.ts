import type { Temporal } from '@js-temporal/polyfill'

/**
 * Domain types for the calendar kernel. Copied into `time-core` so the package
 * is self-contained (deps: only `@tanstack/store` + `@js-temporal/polyfill`).
 *
 * NOTE: trimmed during scaffolding to the entities the kernel needs. Recurrence,
 * dependency, availability and timeline types are copied in as their owning
 * features land.
 */

export type EventDateTimeInput = string | Date | number

export type DateInput = string | number | Date | Temporal.ZonedDateTime

/** How often a recurring event repeats. */
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** A single dependency from one event to another. */
export interface EventDependency {
  id: string
  type: 'FS' | 'SS' | 'FF' | 'SF'
}

/** The structured repeat definition on a master event (UI-builder subset). */
export interface RecurrenceRule<TResource extends Resource = Resource> {
  frequency: RecurrenceFrequency
  interval?: number
  /**
   * Inclusive upper bound (RFC 5545), `YYYY-MM-DD`: an occurrence whose date
   * falls exactly on `until` is emitted; expansion stops after it.
   */
  until?: string
  count?: number
  byWeekday?: Array<number>
  exDates?: Array<EventDateTimeInput>
  // overrides are copied in with recurrenceFeature
  overrides?: Array<Record<string, unknown> & { originalStart: EventDateTimeInput }>
  _resource?: TResource
}

/** A recurring weekly availability window for a resource. */
export interface Availability {
  /** ISO weekdays the window applies to (1 = Mon … 7 = Sun). */
  weekdays: Array<number>
  /** Window start, `HH:mm`. */
  startTime: string
  /** Window end, `HH:mm`. */
  endTime: string
}

export interface Resource {
  id: string
  label: string
  /** Weekly availability windows; absent ⇒ always available. */
  availability?: Array<Availability>
  capacity?: Array<number>
}

/** Why a resource is unavailable for a placement (one per conflicting resource). */
export interface UnavailabilityReason {
  resourceId: string
  resourceLabel: string
  reason: 'outside-hours' | 'capacity' | 'no-availability'
  description: string
  capacityInfo?: {
    max: number
    used: number
    remaining: number
  }
}

/** A concrete availability/capacity conflict for an attempted placement. */
export interface AvailabilityConflict {
  /** Date the conflict occurred (`YYYY-MM-DD`). */
  date: string
  conflictRange: { start: string; end: string }
  resourceIds: Array<string>
  resourceDetails: Array<UnavailabilityReason>
  description: string
}

/** A pixel-positioned unavailable band, for rendering blocked time. */
export interface UnavailableRange {
  top: number
  height: number
  startTime: string
  endTime: string
}

/** Which slice of a recurring series an edit applies to. */
export type RecurrenceEditScope = 'this' | 'thisAndFollowing' | 'all'

/** Error info when a resize/placement is blocked. */
export interface ResizeError {
  eventId: string
  eventTitle: string
  reason: 'unavailable-time' | 'invalid-time' | 'min-duration' | 'blocked'
  message: string
  originalStart: string
  originalEnd: string
  attemptedStart?: string
  attemptedEnd?: string
  conflicts?: Array<AvailabilityConflict>
}

/** Result of an event save/edit. */
export type SaveEventResult =
  | { success: true }
  | { success: false; error: ResizeError }

/** The kernel's window onto time: current period + the unit that sizes it. */
export interface ViewMode {
  /** Number of units the view spans. */
  value: number
  /** Unit of time the view displays. Views match against this. */
  unit: 'month' | 'week' | 'day' | 'workWeek' | 'timeline' | 'agenda'
}

export interface Event<TResource extends Resource = Resource> {
  id: string
  start: EventDateTimeInput
  end: EventDateTimeInput
  title: string
  resources?: Array<TResource | string>
  consumption?: Array<number>
  dependsOn?: Array<EventDependency>
  recurrence?: RecurrenceRule<TResource>
  allDay?: boolean
  /** Original start before multi-day splitting (segments only). */
  _originalStart?: string
  /** Original end before multi-day splitting (segments only). */
  _originalEnd?: string
  /** Master recurring event id (ephemeral occurrences only). */
  _recurringMasterId?: string
  _occurrenceIndex?: number
  _occurrenceOriginalStart?: string
}

/** Plain data shape of a day, before feature node-methods are attached. */
export interface Day<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  date: Temporal.PlainDate
  isoDate: string
  events: Array<TEvent>
  allDayEvents: Array<TEvent>
  isToday: boolean
  isInCurrentPeriod: boolean
}

export interface TimeSlot {
  hour: number
  minute: number
  label: string
}

/** Reactive state held in the `@tanstack/store`. */
export interface CalendarStore {
  currentPeriod: Temporal.PlainDate
  activeDate: Temporal.PlainDate
  viewMode: ViewMode
  /**
   * The event collection (normalized to wall-time strings at ingestion). Lives in
   * the store so the projection memos invalidate on the array reference. Seeded
   * from `options.events`; internal mutations replace it; a controlled consumer
   * re-feeds a fresh `options.events` each render (v9 `data` channel).
   */
  events: Array<Event>
  /** True while an async fetch is in-flight for the current viewport. */
  isPending: boolean
}

/** Date/locale/timezone configuration shared by the date layer. */
export interface DateCoreOptions {
  locale?: string
  timeZone?: string
  weekStartsOn?: number
}
