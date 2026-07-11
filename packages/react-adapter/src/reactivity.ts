import { batch, createAtom } from '@tanstack/react-store'
import type {
  CalendarAtomOptions,
  CalendarReactivityBindings,
} from '@tanstack/time-core/reactivity'

/**
 * Creates the time-core reactivity bindings used by the React adapter.
 *
 * React stores calendar state in TanStack Store atoms and leaves options as plain
 * resolved data because `useCalendar` synchronizes options during render.
 */
export function reactReactivity(): CalendarReactivityBindings {
  return {
    createOptionsStore: false,
    wrapExternalAtoms: false,
    addSubscription: () => {
      throw new Error(
        'Feature not supported in current reactivity implementation',
      )
    },
    unmount: () => {
      throw new Error(
        'Feature not supported in current reactivity implementation',
      )
    },
    schedule: (fn) => queueMicrotask(fn),
    batch,
    untrack: (fn) => fn(),
    createReadonlyAtom: <T>(fn: () => T, options?: CalendarAtomOptions<T>) => {
      return createAtom(() => fn(), {
        compare: options?.compare,
      })
    },
    createWritableAtom: <T>(value: T, options?: CalendarAtomOptions<T>) => {
      return createAtom(value, {
        compare: options?.compare,
      })
    },
  }
}
