import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, test } from 'vitest'
import { buildDayCellAttributes } from './getDayCellProps'
import type { Day } from './types'

function makeDay(overrides: Partial<Day> = {}): Day {
  const isoDate = overrides.isoDate ?? '2026-06-17'
  return {
    date: Temporal.PlainDate.from(isoDate),
    isoDate,
    events: [],
    allDayEvents: [],
    isToday: false,
    isInCurrentPeriod: true,
    ...overrides,
  }
}

describe('buildDayCellAttributes', () => {
  test('maps day flags to data attributes', () => {
    const attrs = buildDayCellAttributes(
      makeDay({ isoDate: '2026-06-17', isToday: true, isInCurrentPeriod: true }),
    )
    expect(attrs).toMatchObject({
      'data-iso': '2026-06-17',
      'data-today': true,
      'data-in-period': true,
    })
  })

  test('reflects out-of-period days', () => {
    const attrs = buildDayCellAttributes(
      makeDay({ isInCurrentPeriod: false, isToday: false }),
    )
    expect(attrs['data-in-period']).toBe(false)
    expect(attrs['data-today']).toBe(false)
  })

  test('detects weekend vs weekday for en-US', () => {
    const saturday = buildDayCellAttributes(makeDay({ isoDate: '2026-06-20' }), {
      locale: 'en-US',
    })
    const wednesday = buildDayCellAttributes(
      makeDay({ isoDate: '2026-06-17' }),
      { locale: 'en-US' },
    )
    expect(saturday['data-weekend']).toBe(true)
    expect(wednesday['data-weekend']).toBe(false)
  })
})
