import { describe, expect, it } from 'vitest'
import { toPlainDate, toWallTimeString } from './date-utils'

/**
 * The canonical coercion (grilling decision 2). These assertions are
 * machine-timezone independent by construction: zone-less strings are literal,
 * and every absolute input is given an explicit target zone.
 */
describe('toWallTimeString', () => {
  it('takes a zone-less wall-time string literally (canonicalized to seconds)', () => {
    expect(toWallTimeString('2024-06-12T09:00')).toBe('2024-06-12T09:00:00')
    expect(toWallTimeString('2024-06-12T09:00:30')).toBe('2024-06-12T09:00:30')
    expect(toWallTimeString('2024-06-12 09:00')).toBe('2024-06-12T09:00:00') // space → T
    expect(toWallTimeString('2024-06-12')).toBe('2024-06-12T00:00:00')
  })

  it('converts an absolute Date into the target zone', () => {
    const instant = new Date(Date.UTC(2024, 5, 12, 9, 0, 0))
    expect(toWallTimeString(instant, 'UTC')).toBe('2024-06-12T09:00:00')
    // 09:00 UTC on 2024-06-12 is 05:00 in New York (EDT, -4).
    expect(toWallTimeString(instant, 'America/New_York')).toBe(
      '2024-06-12T05:00:00',
    )
  })

  it('treats an epoch number as milliseconds', () => {
    const ms = Date.UTC(2024, 5, 12, 9, 0, 0)
    expect(toWallTimeString(ms, 'UTC')).toBe('2024-06-12T09:00:00')
  })

  it('honors a Z/offset in the string and converts into the target zone', () => {
    expect(toWallTimeString('2024-06-12T09:00Z', 'UTC')).toBe(
      '2024-06-12T09:00:00',
    )
    // 09:00+02:00 == 07:00Z == 03:00 New York.
    expect(toWallTimeString('2024-06-12T09:00:00+02:00', 'America/New_York')).toBe(
      '2024-06-12T03:00:00',
    )
    expect(toWallTimeString('2024-06-12T09:00:00+0200', 'UTC')).toBe(
      '2024-06-12T07:00:00',
    )
  })

  it('rejects malformed input', () => {
    expect(() => toWallTimeString('not-a-date')).toThrow()
  })

  it('toPlainDate agrees with toWallTimeString (no UTC-vs-local split)', () => {
    const instant = new Date(Date.UTC(2024, 5, 12, 23, 30, 0))
    expect(toPlainDate('2024-06-12T09:00').toString()).toBe('2024-06-12')
    // both go through the same coercion, so the date component matches.
    expect(toPlainDate(instant).toString()).toBe(
      toWallTimeString(instant).slice(0, 10),
    )
  })
})
