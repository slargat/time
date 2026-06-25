import type { IsAny, UnionToIntersection } from './type-utils'
import type { Calendar_Internal } from './Calendar'
import type { CalendarStore, Event, Resource } from '../types'

/**
 * The feature-composition core, mirroring TanStack Table v9 (beta).
 *
 * Features are passed to `constructCalendar` as an **object** keyed by feature
 * name (`features: { historyFeature, eventsFeature }`) — never an array. Because
 * the keys of an object literal are inferred literally (object property names do
 * not widen the way tuple element positions do), the present features are known
 * to the type system **without `as const`**. The instance type then includes a
 * feature's API only when its key is present (see {@link ExtractFeatureMapTypes}).
 */

type UnionToIntersectionOrEmpty<T> = [T] extends [never]
  ? {}
  : UnionToIntersection<T> & {}

/**
 * Given the registered features `TFeatures` and a map of `featureKey -> apiType`,
 * produce the intersection of the API types whose keys are actually present.
 *
 * This is the load-bearing type: `Calendar<TF>` only exposes `undo()` when
 * `historyFeature` is a key of `TF`.
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

/**
 * Declaration-merge into this interface to register a custom (third-party)
 * feature so it composes with the same inference as the built-ins.
 */
export interface Plugins {}

/** Always-on features merged in by `constructCalendar`. */
export interface CoreCalendarFeatures {
  coreCalendarFeature: CalendarFeature
}

/** Opt-in features shipped with `@tanstack/time`. */
export interface StockCalendarFeatures {
  eventsFeature: CalendarFeature
  historyFeature: CalendarFeature
}

/**
 * The registry of all known feature keys. All-optional so the object you pass
 * to `features` is both the opt-in list and the type constraint.
 */
export interface CalendarFeatures
  extends Partial<CoreCalendarFeatures>,
    Partial<StockCalendarFeatures>,
    Partial<Plugins> {}

/**
 * A feature module. Each hook is optional; a feature implements only the slots
 * it needs.
 *
 * - `constructCalendarApis` assigns table-level methods directly onto the
 *   singleton instance (built once, never per-render).
 * - `assignEventPrototype` / `assignDayPrototype` add node methods to a shared
 *   prototype so every event/day node shares one set of functions.
 */
export interface CalendarFeature {
  /** Contribute default state before the store is created. */
  getInitialState?(state: Partial<CalendarStore>): Partial<CalendarStore>
  /** Assign this feature's methods onto the calendar singleton. */
  constructCalendarApis?<
    TFeatures extends CalendarFeatures,
    R extends Resource,
    E extends Event<R>,
  >(
    calendar: Calendar_Internal<TFeatures, R, E>,
  ): void
  /** Add methods to the shared event-node prototype. */
  assignEventPrototype?<
    TFeatures extends CalendarFeatures,
    R extends Resource,
    E extends Event<R>,
  >(
    prototype: Record<string, any>,
    calendar: Calendar_Internal<TFeatures, R, E>,
  ): void
  /** Add methods to the shared day-node prototype. */
  assignDayPrototype?<
    TFeatures extends CalendarFeatures,
    R extends Resource,
    E extends Event<R>,
  >(
    prototype: Record<string, any>,
    calendar: Calendar_Internal<TFeatures, R, E>,
  ): void
  /** Tear down listeners/timers when the calendar is destroyed. */
  destroy?(calendar: Calendar_Internal<any, any, any>): void
}
