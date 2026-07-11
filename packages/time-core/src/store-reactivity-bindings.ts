import { batch, createAtom } from '@tanstack/store'
import type { CalendarReactivityBindings } from './core/reactivity/core-reactivity.types'

/**
 * TanStack Store–based reactivity for vanilla / non-framework use of
 * `constructCalendar`. Ported from v9 `store-reactivity-bindings.ts`.
 *
 * Framework adapters (react-time, solid-time) provide their own bindings; this
 * is the default so `constructCalendar` works standalone (and in tests) without
 * an adapter. `constructCalendar` falls back to this when
 * `features.coreReactivityFeature` is absent.
 */
export function storeReactivityBindings(): CalendarReactivityBindings {
  return {
    createOptionsStore: true,
    wrapExternalAtoms: false,
    addSubscription: () => {
      throw new Error(
        'Feature not supported in current reactivity implementation',
      )
    },
    // No framework-managed subscriptions in the vanilla path (schedule is a bare
    // queueMicrotask, atoms are GC'd), so teardown is a no-op. Must not throw:
    // `calendar.destroy()` calls this on every standalone/test unmount.
    unmount: () => {},
    batch,
    schedule: (fn) => queueMicrotask(fn),
    untrack: (fn) => fn(),
    createReadonlyAtom: (fn, options) =>
      createAtom(() => fn(), { compare: options?.compare }),
    createWritableAtom: (value, options) =>
      createAtom(value, { compare: options?.compare }),
  }
}
