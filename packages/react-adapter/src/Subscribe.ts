'use client'

import { useSelector } from '@tanstack/react-store'
import { shallowSelected } from './compare'
import type { CalendarStore } from '@tanstack/time-core'
import type {
  Atom,
  ReadonlyAtom,
  ReadonlyStore,
  Store,
} from '@tanstack/react-store'
import type { FunctionComponent, ReactNode } from 'react'

export type SubscribeSource<TValue> =
  | Atom<TValue>
  | ReadonlyAtom<TValue>
  | Store<TValue>
  | ReadonlyStore<TValue>

/**
 * Subscribe to `calendar.store` (full calendar state). The selector receives the
 * full {@link CalendarStore}. The calendar store is a flat, feature-independent
 * shape — so, unlike the table's `TableState<TFeatures>`, there's no feature
 * generic here.
 */
export type SubscribePropsWithStore<TSelected> = {
  source: SubscribeSource<CalendarStore>
  /**
   * Select from full calendar state. Re-renders when the selected value changes
   * (shallow compare).
   *
   * Required in store mode so you never accidentally subscribe to the whole
   * store without an explicit projection.
   */
  selector: (state: CalendarStore) => TSelected
  children: ((state: TSelected) => ReactNode) | ReactNode
}

/**
 * Subscribe to the full value of a source (e.g. `table.atoms.rowSelection` or
 * `table.optionsStore`). Omitting `selector` is equivalent to the identity
 * selector — children receive `TSourceValue`.
 */
export type SubscribePropsWithSourceIdentity<TSourceValue> = {
  source: SubscribeSource<TSourceValue>
  selector?: undefined
  children: ((state: TSourceValue) => ReactNode) | ReactNode
}

/**
 * Subscribe to a projected value from a source (atom or store). The selector
 * receives the source value; children receive the projected `TSelected`.
 */
export type SubscribePropsWithSourceWithSelector<TSourceValue, TSelected> = {
  source: SubscribeSource<TSourceValue>
  selector: (state: TSourceValue) => TSelected
  children: ((state: TSelected) => ReactNode) | ReactNode
}

/**
 * Subscribe to a single source — atom or store (identity or projected). Prefer
 * {@link SubscribePropsWithSourceIdentity} or {@link SubscribePropsWithSourceWithSelector}
 * for clearer inference when `selector` is omitted.
 */
export type SubscribePropsWithSource<TSourceValue, TSelected = TSourceValue> =
  | SubscribePropsWithSourceIdentity<TSourceValue>
  | SubscribePropsWithSourceWithSelector<TSourceValue, TSelected>

export type SubscribeProps<TSelected = unknown, TSourceValue = unknown> =
  | SubscribePropsWithStore<TSelected>
  | SubscribePropsWithSourceIdentity<TSourceValue>
  | SubscribePropsWithSourceWithSelector<TSourceValue, TSelected>

/**
 * A React component for subscribing to calendar state — opt specific parts of
 * the tree into re-renders for just the state they read.
 *
 * For `calendar.Subscribe` from `useCalendar`, prefer that API — it uses
 * overloads so JSX contextual typing works. This standalone component takes a
 * union `props` type and can target any atom or store via `source`.
 *
 * @example
 * ```tsx
 * // Full store with a projection
 * <Subscribe source={calendar.store} selector={(s) => s.viewMode}>
 *   {(viewMode) => <span>{viewMode.unit}</span>}
 * </Subscribe>
 * ```
 *
 * @example
 * ```tsx
 * // Any atom/store source, no selector (identity)
 * <Subscribe source={someAtom}>
 *   {(value) => <div>{String(value)}</div>}
 * </Subscribe>
 * ```
 *
 * @example
 * ```tsx
 * // As calendar.Subscribe (instance method)
 * <calendar.Subscribe selector={(s) => s.currentPeriod}>
 *   {(currentPeriod) => <span>{currentPeriod.toString()}</span>}
 * </calendar.Subscribe>
 * ```
 */
export function Subscribe<TSourceValue>(
  props: SubscribePropsWithSourceIdentity<TSourceValue>,
): ReturnType<FunctionComponent>
export function Subscribe<TSourceValue, TSelected>(
  props: SubscribePropsWithSourceWithSelector<TSourceValue, TSelected>,
): ReturnType<FunctionComponent>
export function Subscribe<TSelected>(
  props: SubscribePropsWithStore<TSelected>,
): ReturnType<FunctionComponent>
export function Subscribe<TSelected, TSourceValue>(
  props: SubscribeProps<TSelected, TSourceValue>,
): ReturnType<FunctionComponent> {
  const selected = useSelector(
    // Atom and store share the same selection protocol; union args need a widen for TS.
    props.source,
    props.selector as Parameters<typeof useSelector>[1],
    {
      compare: shallowSelected,
    },
  ) as TSelected

  return typeof props.children === 'function'
    ? (props.children as (state: TSelected) => ReactNode)(selected)
    : props.children
}
