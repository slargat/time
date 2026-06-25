import type { Temporal } from '@js-temporal/polyfill'
import type { Store } from '@tanstack/store'
import type { DateCoreOptions } from '../date-core'
import type {
  CalendarStore,
  Day,
  Event,
  EventDateTimeInput,
  Resource,
  ViewMode,
} from '../types'
import type {
  CalendarFeature,
  CalendarFeatures,
  ExtractFeatureMapTypes,
} from './CalendarFeatures'
import type { UnionToIntersection } from './type-utils'
import type { Calendar_Events } from '../features/eventsFeature.types'
import type { Calendar_Crud } from '../features/eventCrudFeature.types'
import type { Calendar_History } from '../features/historyFeature.types'

export interface CalendarOptions<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> extends DateCoreOptions {
  /** Opt-in feature modules, keyed by name. No `as const` required. */
  features: TFeatures
  events?: Array<TEvent> | null
  resources?: Array<TResource> | null
  initialState?: Partial<CalendarStore>
}

/** The always-present surface: navigation, day derivation, and the store. */
export interface Calendar_Core<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  store: Store<CalendarStore>
  options: CalendarOptions<TFeatures, TResource, TEvent>
  goToNextPeriod: () => void
  goToPreviousPeriod: () => void
  goToCurrentPeriod: () => void
  goToSpecificPeriod: (date: EventDateTimeInput) => void
  canGoNextPeriod: () => boolean
  canGoPreviousPeriod: () => boolean
  changeViewMode: (viewMode: ViewMode) => void
  getWeekStartsOn: () => number
  getDaysNames: (weekday?: 'long' | 'short') => Array<string>
  /**
   * Day objects for the current view. Each day's `events`/`allDayEvents` are
   * populated when `eventsFeature` is registered, otherwise empty.
   */
  getDays: () => Array<Day<TResource, TEvent>>
}

/**
 * Maps each feature key to the API it contributes to the calendar instance.
 * (Parameterise by `TFeatures` once a feature augments node types by it.)
 */
export interface Calendar_FeatureMap<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  eventsFeature: Calendar_Events<TResource, TEvent>
  eventCrudFeature: Calendar_Crud<TResource, TEvent>
  historyFeature: Calendar_History
}

/**
 * The composed instance type: core surface plus the APIs of exactly the
 * features registered in `TFeatures`. `calendar.undo()` only type-checks when
 * `historyFeature` is a key of `TFeatures`.
 */
export type Calendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> = Calendar_Core<TFeatures, TResource, TEvent> &
  ExtractFeatureMapTypes<TFeatures, Calendar_FeatureMap<TResource, TEvent>>

/** Intersection of every stock feature API — the broad shape feature code sees. */
type AllFeatureApis<TResource extends Resource, TEvent extends Event<TResource>> =
  UnionToIntersection<Calendar_FeatureMap<TResource, TEvent>[keyof Calendar_FeatureMap<TResource, TEvent>]>

/**
 * The broad internal view passed to feature hooks: every feature API (so e.g.
 * resize can call crud) plus construction internals.
 */
export type Calendar_Internal<
  TFeatures extends CalendarFeatures = CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> = Calendar_Core<TFeatures, TResource, TEvent> &
  AllFeatureApis<TResource, TEvent> & {
    _features: Record<string, CalendarFeature>
    _eventPrototype: Record<string, any>
    _dayPrototype: Record<string, any>
    /** Bare Temporal day list for the current view (no events). */
    _getCalendarDays: () => Array<Temporal.PlainDate>
  }
