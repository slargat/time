import type { Temporal } from '@js-temporal/polyfill'
import type { Store } from '@tanstack/store'
import type { DateCoreOptions } from '../date-core'
import type {
  CalendarStore,
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
import type {
  Calendar_Events,
  EventNode_Events,
} from '../features/eventsFeature.types'
import type { Calendar_Crud } from '../features/eventCrudFeature.types'
import type { Calendar_Timeline } from '../features/timelineFeature.types'
import type { Calendar_Recurrence } from '../features/recurrenceFeature.types'
import type { Calendar_Dependencies } from '../features/dependenciesFeature.types'
import type { Calendar_LazyFetch } from '../features/lazyFetchFeature.types'
import type { Calendar_History } from '../features/historyFeature.types'
import type {
  Calendar_Resize,
  DayNode_Resize,
  EventNode_Resize,
} from '../features/resizeFeature.types'
import type { ResizeControllerOptions } from '../resizeController'

/** Maps each feature key to the methods it adds to an event node. */
export interface EventNode_FeatureMap<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  eventsFeature: EventNode_Events<TResource, TEvent>
  resizeFeature: EventNode_Resize
}

/** Maps each feature key to the methods it adds to a day node. */
export interface DayNode_FeatureMap {
  resizeFeature: DayNode_Resize
}

/** A single event, plus the node methods contributed by registered features. */
export type EventNode<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> = TEvent &
  ExtractFeatureMapTypes<TFeatures, EventNode_FeatureMap<TResource, TEvent>>

/** The data shape of a day node (its events are event nodes). */
export interface DayNode_Core<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  date: Temporal.PlainDate
  isoDate: string
  events: Array<EventNode<TFeatures, TResource, TEvent>>
  allDayEvents: Array<EventNode<TFeatures, TResource, TEvent>>
  isToday: boolean
  isInCurrentPeriod: boolean
}

/** A day node: its data plus the node methods of registered features. */
export type DayNode<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> = DayNode_Core<TFeatures, TResource, TEvent> &
  ExtractFeatureMapTypes<TFeatures, DayNode_FeatureMap>

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
  /** Options for `resizeFeature`'s drag-resize controller. */
  resize?: ResizeControllerOptions
  /** `lazyFetchFeature`: load events on demand for the visible range. */
  fetchEvents?: (range: {
    start: string
    end: string
  }) => Promise<Array<TEvent>>
}

/** The always-present surface: navigation, day derivation, and the store. */
export interface Calendar_Core<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  store: Store<CalendarStore>
  options: CalendarOptions<TFeatures, TResource, TEvent>
  /** Tear down every feature (resize DOM listeners, timers). */
  destroy: () => void
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
   * Day nodes for the current view. Each day's `events`/`allDayEvents` are
   * populated when `eventsFeature` is registered, otherwise empty. Event/day
   * nodes carry the methods of whatever node features are registered.
   */
  getDays: () => Array<DayNode<TFeatures, TResource, TEvent>>
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
  resizeFeature: Calendar_Resize<TResource, TEvent>
  timelineFeature: Calendar_Timeline<TResource, TEvent>
  recurrenceFeature: Calendar_Recurrence<TResource, TEvent>
  dependenciesFeature: Calendar_Dependencies<TResource>
  lazyFetchFeature: Calendar_LazyFetch
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
