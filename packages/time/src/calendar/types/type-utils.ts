/**
 * Internal type helpers for the feature-composition system.
 * Ported from the TanStack Table v9 (beta) `type-utils` so the calendar's
 * feature-merging behaves identically.
 */

export type Updater<T> = T | ((old: T) => T)

export type OnChangeFn<T> = (updaterOrValue: Updater<T>) => void

/** Collapse a union `A | B | C` into the intersection `A & B & C`. */
export type UnionToIntersection<T> = (
  T extends any ? (x: T) => any : never
) extends (x: infer R) => any
  ? R
  : never

/** `true` when `T` is exactly `any`. Used to short-circuit feature extraction. */
export type IsAny<T> = 0 extends 1 & T ? true : false

/** Flatten an intersection into a single object literal for nicer hover types. */
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & unknown
