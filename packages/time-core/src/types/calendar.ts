import type { Temporal } from '@js-temporal/polyfill'
import type { ResizeControllerOptions } from '../features/resize/resize-controller'
import type { Atom, ReadonlyAtom, ReadonlyStore } from '@tanstack/store'
import type { CalendarReactivityBindings } from '../core/reactivity/core-reactivity.types'
import type {
  CalendarFeature,
  CalendarFeatures,
  CalendarView,
  ExtractFeatureMapTypes,
} from './calendar-features'
import type { ActiveViewModel } from './view-model'
import type {
  CalendarStore,
  DateCoreOptions,
  Event,
  EventDateTimeInput,
  Resource,
  ViewMode,
} from '../types'
import type {
  ProjectionContext,
  ProjectionStage,
  WriteStage,
} from '../pipeline/stages'
import type { OnChangeFn, Updater } from './type-utils'

// ── entity feature-maps (features declaration-merge their node methods here) ──

/** Maps each feature key → the methods it adds to an Event node. */
export interface EventNode_FeatureMap<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  /** phantom: keeps generics in use; never matches a feature key. */
  readonly '~eventNode'?: [TResource, TEvent]
}

/** Maps each feature key → the methods it adds to a Day node. */
export interface DayNode_FeatureMap<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  /** phantom: keeps generics in use; never matches a feature key. */
  readonly '~dayNode'?: [TFeatures, TResource, TEvent]
}

/** Maps each feature key → the methods it adds to the Calendar singleton. */
export interface Calendar_FeatureMap<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  /** phantom: keeps generics in use; never matches a feature key. */
  readonly '~calendar'?: [TFeatures, TResource, TEvent]
}

// ── entities ─────────────────────────────────────────────────────────────────

/** An Event node: the event data plus registered features' node methods. */
export type EventNode<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> = TEvent &
  ExtractFeatureMapTypes<TFeatures, EventNode_FeatureMap<TResource, TEvent>>

/** The data shape of a Day node (its events are Event nodes). */
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

/** A Day node: its data plus registered features' node methods. */
export type DayNode<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> = DayNode_Core<TFeatures, TResource, TEvent> &
  ExtractFeatureMapTypes<
    TFeatures,
    DayNode_FeatureMap<TFeatures, TResource, TEvent>
  >

// ── options ──────────────────────────────────────────────────────────────────

export interface CalendarOptions<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> extends DateCoreOptions {
  /** Opt-in features, keyed by name. No `as const` required. */
  features: TFeatures
  events?: Array<TEvent> | null
  resources?: Array<TResource> | null
  /**
   * Seed values for state slices. Feature reset APIs use these by default.
   * Changing this object later does not reset state, so it need not be stable.
   */
  initialState?: Partial<CalendarStore>
  /**
   * Externally controlled state slices. Pair each slice with its matching
   * `on<Slice>Change` callback so updates can be persisted outside the calendar
   * (e.g. driven from a React `useState`). External `atoms` take precedence over
   * this option when both are provided for the same slice.
   */
  state?: Partial<CalendarStore>
  /**
   * Optional app-owned writable atoms per slice. When an atom is provided for a
   * slice it takes precedence over `state[key]` and the internal base atom;
   * state update APIs write through it. The preferred v9 ownership model.
   */
  atoms?: Partial<{ [K in keyof CalendarStore]: Atom<CalendarStore[K]> }>
  /** Persist `currentPeriod` updates externally (pair with `state.currentPeriod`). */
  onCurrentPeriodChange?: OnChangeFn<CalendarStore['currentPeriod']>
  /** Persist `activeDate` updates externally (pair with `state.activeDate`). */
  onActiveDateChange?: OnChangeFn<CalendarStore['activeDate']>
  /** Persist `viewMode` updates externally (pair with `state.viewMode`). */
  onViewModeChange?: OnChangeFn<CalendarStore['viewMode']>
  /**
   * Called with the new collection whenever events change internally (CRUD,
   * resize, lazy fetch). Provide it to control the collection: own the
   * events in your own state and re-feed a fresh `options.events` each render
   * (v9 `data`/`onDataChange`). Omit it and the calendar owns the collection
   * (uncontrolled); `options.events` is then the initial seed.
   */
  onEventsChange?: OnChangeFn<CalendarStore['events']>
  /** Persist `isPending` updates externally (pair with `state.isPending`). */
  onIsPendingChange?: OnChangeFn<CalendarStore['isPending']>
  /** Override option merging on `setOptions` (defaults to a shallow merge). */
  mergeOptions?: (
    defaultOptions: CalendarOptions<TFeatures, TResource, TEvent>,
    options: Partial<CalendarOptions<TFeatures, TResource, TEvent>>,
  ) => CalendarOptions<TFeatures, TResource, TEvent>
  /** Async source for `lazyFetchFeature` — resolve events for a date range. */
  fetchEvents?: (range: {
    start: string
    end: string
  }) => Promise<Array<TEvent>>
  /** Options for `resizeFeature`'s drag controller. */
  resize?: ResizeControllerOptions
}

// ── the instance ─────────────────────────────────────────────────────────────

/** The always-present surface: store, navigation, and the active view model. */
export interface Calendar_Core<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  /** Read-only derived view of state (atom-backed). Writes go through APIs. */
  store: ReadonlyStore<CalendarStore>
  options: CalendarOptions<TFeatures, TResource, TEvent>
  /**
   * Merge new options into the instance and re-sync controlled `state` slices
   * into the atom graph (v9 `table.setOptions`). The React adapter calls this
   * every render so `options.state` from a `useState` stays reflected.
   */
  setOptions: (
    updater: Updater<CalendarOptions<TFeatures, TResource, TEvent>>,
  ) => void
  destroy: () => void
  goToNextPeriod: () => void
  goToPreviousPeriod: () => void
  goToCurrentPeriod: () => void
  changeViewMode: (viewMode: ViewMode) => void
  goToSpecificPeriod: (date: EventDateTimeInput) => void
  /** Build the active view's view model (a `viewMode`-discriminated union). */
  getView: () => ActiveViewModel<TFeatures, TResource, TEvent>
  /** The raw event collection (always present; `coreEventsFeature` is core). */
  getEvents: () => Array<TEvent>
  /** The viewport's Day nodes (projected + bucketed) — a View's `build` input. */
  getProjectedDays: () => Array<DayNode<TFeatures, TResource, TEvent>>
  /** Fully projected occurrences for the viewport (source→…→availabilityFilter). */
  getProjectedEvents: () => Array<TEvent>
}

/** The public calendar instance: core surface + registered features' APIs. */
export type Calendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> = Calendar_Core<TFeatures, TResource, TEvent> &
  ExtractFeatureMapTypes<
    TFeatures,
    Calendar_FeatureMap<TFeatures, TResource, TEvent>
  >

/** One assembled pipeline stage (kernel-ordered, single-owner). */
export interface AssembledStage<TStage extends string, TFn> {
  stage: TStage
  fn: TFn
}

/**
 * The broad, write-side instance type used during construction and by features.
 * Widens node features to `CalendarFeatures`; the public {@link Calendar} narrows
 * them back for callers.
 */
export interface Calendar_Internal<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> extends Calendar_Core<TFeatures, TResource, TEvent> {
  _features: Record<string, CalendarFeature>
  _reactivity: CalendarReactivityBindings
  _eventPrototype: Record<string, any>
  _dayPrototype: Record<string, any>
  _projection: Array<AssembledStage<ProjectionStage, unknown>>
  /** Lazy per-stage memoized model cache (v9 `table._rowModels`). */
  _projectionModels: Partial<Record<ProjectionStage, () => ProjectionContext>>
  _write: Array<AssembledStage<WriteStage, unknown>>
  _views: Array<CalendarView>
  /** Per-state-key writable atoms (mutation targets; v9 `baseAtoms`). */
  baseAtoms: Record<string, Atom<any>>
  /** Per-state-key readonly atoms (v9 `atoms`). */
  atoms: Record<string, ReadonlyAtom<any>>
  initialState: CalendarStore
  // features assign their static fns here at construction
  [key: string]: any
}
