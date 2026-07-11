import type { IsAny, UnionToIntersection } from './type-utils'
import type { CalendarOptions, Calendar_Internal } from './calendar'
import type { CalendarStore, Event, Resource, ViewMode } from '../types'
import type { ProjectionStageFns, WriteStageFns } from '../pipeline/stages'

/**
 * The feature-composition core, mirroring TanStack Table v9 `table-core`.
 *
 * Features are passed to `constructCalendar` as an OBJECT keyed by feature name
 * (`features: { recurrenceFeature, monthViewFeature }`) — never an array. Object
 * keys infer literally without `as const`, so the present features are known to
 * the type system. The instance type includes a feature's API only when its key
 * is present (see {@link ExtractFeatureMapTypes}).
 */

type UnionToIntersectionOrEmpty<T> = [T] extends [never]
  ? {}
  : UnionToIntersection<T> & {}

/**
 * Given registered `TFeatures` and a `featureKey -> apiType` map, intersect the
 * API types whose keys are actually present. The load-bearing inference: a
 * `getX` exists only when feature `X` is registered.
 */
export type ExtractFeatureMapTypes<
  TFeatures extends CalendarFeatures,
  TFeatureMap extends object,
> =
  IsAny<TFeatures> extends true
    ? UnionToIntersection<TFeatureMap[keyof TFeatureMap]>
    : UnionToIntersectionOrEmpty<
        TFeatureMap[Extract<keyof TFeatures, keyof TFeatureMap>]
      >

/** Declaration-merge target for custom (third-party) features. */
export interface Plugins {}

/** Always-on features merged in by `constructCalendar`. */
export interface CoreCalendarFeatures {
  coreCalendarFeature: CalendarFeature
  coreDaysFeature: CalendarFeature
  coreEventsFeature: CalendarFeature
  coreProjectionFeature: CalendarFeature
  coreViewModelsFeature: CalendarFeature
}

/**
 * Opt-in features shipped with `@tanstack/time-core`. Behavior features and View
 * features share this one registry (a View is a Feature). Grows as features land.
 */
export interface StockCalendarFeatures {
  availabilityFeature: CalendarFeature
  dependenciesFeature: CalendarFeature
  eventCrudFeature: CalendarFeature
  lazyFetchFeature: CalendarFeature
  monthViewFeature: CalendarFeature
  recurrenceFeature: CalendarFeature
  resizeFeature: CalendarFeature
  timeGridViewFeature: CalendarFeature
  timelineViewFeature: CalendarFeature
}

/** The registry of all known feature keys. All-optional: the object you pass is
 * both the opt-in list and the type constraint. */
export interface CalendarFeatures
  extends
    Partial<CoreCalendarFeatures>,
    Partial<StockCalendarFeatures>,
    Partial<Plugins> {}

/**
 * Maps a feature/slot key to the feature(s) that must be registered alongside it
 * (v9 `FeatureSlotPrereqs`). Declaration-merge prerequisites here so
 * {@link calendarFeatures} validates them. Empty until a feature needs a peer
 * (e.g. a behavior feature that reads a View's output shape).
 *
 * `resizeFeature` is write-only — every interaction dispatches a write — so it
 * requires `eventCrudFeature` (the `commit` owner) at compile time. Features that
 * have read-only uses too (recurrence expansion, dependency validation) are
 * deliberately NOT listed here; their write paths are guarded at dispatch instead,
 * so read-only consumers aren't forced to register `eventCrudFeature`.
 */
export interface FeatureSlotPrereqs {
  resizeFeature: 'eventCrudFeature'
}

/**
 * Validates that every slot in a features object is accompanied by its
 * prerequisite feature (v9 `ValidateFeatureSlots`). With an empty
 * {@link FeatureSlotPrereqs} this resolves to `{}`, so it's a no-op today.
 */
export type ValidateFeatureSlots<TFeatures extends CalendarFeatures> =
  IsAny<TFeatures> extends true
    ? {}
    : {
        [K in keyof TFeatures as K extends keyof FeatureSlotPrereqs
          ? K
          : never]: K extends keyof FeatureSlotPrereqs
          ? [Extract<FeatureSlotPrereqs[K], keyof TFeatures>] extends [never]
            ? `Error: '${K & string}' requires '${FeatureSlotPrereqs[K] &
                string}' to be included in this calendar's features.`
            : TFeatures[K]
          : never
      }

/**
 * A View descriptor (decision B from the grilling): a View is a Feature carrying
 * this. `matches(viewMode)` selects it as the active view; `build` produces its
 * view model. Only the active view is built.
 */
export interface CalendarView {
  matches: (viewMode: ViewMode) => boolean
  build: (calendar: Calendar_Internal<any, any, any>) => unknown
}

/**
 * A feature module. Each hook is optional; a feature implements only the slots
 * it needs.
 *
 * - `constructCalendarApis` assigns table-level methods onto the singleton.
 * - `assignEventPrototype` / `assignDayPrototype` add node methods to a shared
 *   prototype (v9's `assignRowPrototype`/`assignCellPrototype` pattern).
 * - `projection` / `write` fill kernel-ordered pipeline stages (ADR 0001/0007),
 *   single-owner per stage.
 * - `view` marks this feature as a View.
 */
export interface CalendarFeature {
  /** Contribute default state before the store is created. */
  getInitialState?: (state: Partial<CalendarStore>) => Partial<CalendarStore>
  /** Contribute default options (v9 `getDefaultTableOptions`). */
  getDefaultOptions?: (
    calendar: Calendar_Internal<any, any, any>,
  ) => Partial<CalendarOptions<any, any, any>>
  /** Assign this feature's methods onto the calendar singleton. */
  constructCalendarApis?: (calendar: Calendar_Internal<any, any, any>) => void
  /** Add methods to the shared event-node prototype. */
  assignEventPrototype?: (
    prototype: Record<string, any>,
    calendar: Calendar_Internal<any, any, any>,
  ) => void
  /** Add methods to the shared day-node prototype. */
  assignDayPrototype?: (
    prototype: Record<string, any>,
    calendar: Calendar_Internal<any, any, any>,
  ) => void
  /** Read-projection stages this feature fills (kernel orders them). */
  projection?: ProjectionStageFns
  /** Write-pipeline stages this feature fills (kernel orders them). */
  write?: WriteStageFns
  /** Present iff this feature is a View. */
  view?: CalendarView
  /** Tear down listeners/timers when the calendar is destroyed. */
  destroy?: (calendar: Calendar_Internal<any, any, any>) => void
}

// re-exported so feature files import entity generics from one place
export type { Event, Resource }
