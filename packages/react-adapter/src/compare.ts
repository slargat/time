import { shallow } from '@tanstack/react-store'

/** Plain `{}` / null-proto object — safe to compare by its own enumerable keys. */
function isPlainObject(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * `shallow`, but scoped to plain objects and arrays.
 *
 * Exotic objects (Temporal, `Date`, `Map`…) keep their data in internal slots,
 * not own enumerable keys, so `Object.keys()` is `[]` and `shallow` reports two
 * *different* values as equal. A selector returning a Temporal `currentPeriod`
 * then never re-renders on navigation — it goes stale. For those we fall back to
 * `Object.is`, which re-renders exactly when the reference changes.
 */
export function shallowSelected(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  const aPlain = Array.isArray(a) || isPlainObject(a)
  const bPlain = Array.isArray(b) || isPlainObject(b)
  return aPlain && bPlain ? shallow(a, b) : false
}
