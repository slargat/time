import type {
  Atom,
  AtomOptions,
  ReadonlyAtom,
  Subscription,
} from '@tanstack/store'

/**
 * Reactivity bindings, ported from v9 `core/reactivity/coreReactivityFeature.types.ts`
 * and renamed to the calendar. Framework adapters (react-time, solid-time)
 * provide concrete implementations; `store-reactivity-bindings.ts` is the vanilla
 * default used standalone.
 */

export interface CalendarAtomOptions<T> extends AtomOptions<T> {
  /** A debug name for the atom, useful for debugging. */
  debugName: string
}

export interface CalendarReactivityBindings {
  createOptionsStore: boolean
  wrapExternalAtoms: boolean
  addSubscription: (subscription: Subscription) => void
  /** Creates a writable atom with an initial value. */
  createWritableAtom: <T>(
    initialValue: T,
    options?: CalendarAtomOptions<T>,
  ) => Atom<T>
  /** Creates a readonly/derived atom from a compute function. */
  createReadonlyAtom: <T>(
    fn: () => T,
    options?: CalendarAtomOptions<T>,
  ) => ReadonlyAtom<T>
  /** Evaluates a function without tracking reactive dependencies. */
  untrack: <T>(fn: () => T) => T
  /** Batches reactive updates to avoid intermediate recomputation. */
  batch: (fn: () => void) => void
  /** Schedules a function to run after the current call stack. */
  schedule: (fn: () => void) => void
  /** Cleanup hook called when the calendar is destroyed/unmounted. */
  unmount?: () => void
}
