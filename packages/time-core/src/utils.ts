import type { Calendar_Internal } from './types/calendar'
import type { Updater } from './types/type-utils'
import type { CalendarStore } from './types'

// Re-exported from its canonical home so existing `from '../utils'` imports keep
// working without a second definition.
export type { Updater } from './types/type-utils'

/**
 * The composition spine, ported from TanStack Table v9 `utils.ts` and adapted to
 * the calendar's entities. The naming convention is identical: a static fn named
 * `parent_fnKey` (e.g. `calendar_getView`, `day_getEvents`, `event_getProps`) is
 * installed as the method `fnKey` on that entity.
 *
 * ponytail: the dev-timing `tableMemo` wrapper is dropped — the plain `memo` is
 * what the kernel needs. Add debug timing back if/when devtools want it.
 */

export function functionalUpdate<T>(updater: Updater<T>, input: T): T {
  return typeof updater === 'function'
    ? (updater as (i: T) => T)(input)
    : updater
}

/**
 * The default `on<Slice>Change` handler (v9 `makeStateUpdater`): write a state
 * slice through its owning atom. An external `options.atoms[key]` takes
 * precedence over the internal `baseAtoms[key]`, so app-managed atoms stay the
 * single source of truth. Consumers controlling a slice replace this with their
 * own handler (paired with `options.state[key]`).
 */
export function makeCalendarStateUpdater<TKey extends keyof CalendarStore>(
  key: TKey,
  // Minimal structural shape so any calendar view can be passed.
  instance: {
    readonly options: { readonly atoms?: object | undefined }
    readonly baseAtoms: object
  },
) {
  return (updater: Updater<CalendarStore[TKey]>) => {
    const externalAtom = (instance.options.atoms as Record<string, any> | undefined)?.[key]
    const targetAtom = externalAtom ?? (instance.baseAtoms as Record<string, any>)[key]
    targetAtom.set((old: CalendarStore[TKey]) => functionalUpdate(updater, old))
  }
}

/** Null-prototype dictionary so user ids like `__proto__` stay plain data. */
export function makeObjectMap<TValue = unknown>(): Record<string, TValue> {
  return Object.create(null) as Record<string, TValue>
}

/** Dependency-tracked memo. Recomputes only when the dep tuple changes. */
export function memo<TDeps extends ReadonlyArray<any>, TResult>(opts: {
  memoDeps?: () => [...TDeps] | undefined
  fn: (...args: TDeps) => TResult
}): () => TResult {
  let deps: Array<any> | undefined
  let result: TResult | undefined
  let hasRun = false
  return (): TResult => {
    const next = opts.memoDeps?.()
    let changed = !hasRun || !next || !deps || next.length !== deps.length
    if (!changed && next && deps) {
      for (let i = 0; i < next.length; i++) {
        if (next[i] !== deps[i]) {
          changed = true
          break
        }
      }
    }
    if (!changed) return result!
    deps = next
    hasRun = true
    result = opts.fn(...((next ?? []) as TDeps))
    return result
  }
}

/** Split a `parent_fnKey` static-fn name into its method key. */
export function getFunctionNameInfo(staticFnName: string) {
  const [parentName, fnKey] = staticFnName.split('_')
  return { parentName: parentName!, fnKey: fnKey! }
}

interface ApiEntry {
  fn: (...args: Array<any>) => any
  memoDeps?: () => Array<any> | undefined
}

/**
 * Assign APIs directly onto the Calendar singleton (v9 `assignTableAPIs`).
 * `{ calendar_getView: { fn } }` → `calendar.getView`.
 */
export function assignCalendarAPIs(
  _feature: string,
  calendar: Calendar_Internal<any, any, any>,
  apis: Record<string, ApiEntry>,
): void {
  for (const [staticFnName, { fn, memoDeps }] of Object.entries(apis)) {
    const { fnKey } = getFunctionNameInfo(staticFnName)
    ;(calendar as Record<string, any>)[fnKey] = memoDeps
      ? memo({ memoDeps, fn })
      : fn
  }
}

interface PrototypeApiEntry {
  fn: (self: any, ...args: Array<any>) => any
  memoDeps?: (self: any) => Array<any> | undefined
}

/**
 * Assign APIs onto a shared node prototype (v9 `assignPrototypeAPIs`). Every
 * Day/Event instance shares the method; memoized methods lazily cache per
 * instance. `{ day_getEvents: { fn } }` → `dayNode.getEvents`.
 */
export function assignPrototypeAPIs(
  _feature: string,
  prototype: Record<string, any>,
  _calendar: Calendar_Internal<any, any, any>,
  apis: Record<string, PrototypeApiEntry>,
): void {
  for (const [staticFnName, { fn, memoDeps }] of Object.entries(apis)) {
    const { fnKey } = getFunctionNameInfo(staticFnName)
    if (memoDeps) {
      const memoKey = `_memo_${fnKey}`
      prototype[fnKey] = function (this: any, ...args: Array<any>) {
        if (!this[memoKey]) {
          const self = this
          this[memoKey] = memo({
            memoDeps: () => memoDeps(self),
            fn: (...deps: Array<any>) => fn(self, ...deps),
          })
        }
        return this[memoKey](...args)
      }
    } else {
      prototype[fnKey] = function (this: any, ...args: Array<any>) {
        return fn(this, ...args)
      }
    }
  }
}
