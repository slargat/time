import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { monthViewFeature } from '../month-view/month-view-feature'
import { recurrenceFeature } from './recurrence-feature'
import type { Event } from '../../types'

// Ported from packages/time calendar.test.ts ("recurrence exceptions"), retargeted
// to time-core's constructCalendar + getProjectedEvents. 2024-03-18 is a Monday;
// the master starts 2024-03-04 (also a Monday) so every occurrence below stays
// inside the March month-view window. UTC throughout.
const march = { currentPeriod: Temporal.PlainDate.from('2024-03-01') }

const projectDates = (events: Array<Event>) => {
  const calendar = constructCalendar({
    features: { monthViewFeature, recurrenceFeature },
    events,
    initialState: march,
  })
  return calendar.getProjectedEvents()
}

const master = (recurrence: Event['recurrence']): Event => ({
  id: 'r',
  title: 'Recurring',
  start: '2024-03-04T09:00',
  end: '2024-03-04T10:00',
  recurrence,
})

describe('recurrence parity', () => {
  it('weekly with byWeekday lands on each listed weekday', () => {
    // Mon (1) + Wed (3), bounded by count so the expansion terminates.
    const occ = projectDates([
      master({ frequency: 'weekly', byWeekday: [1, 3], count: 4 }),
    ])
    expect(occ.map((e) => (e.start as string).slice(0, 10))).toEqual([
      '2024-03-04', // Mon
      '2024-03-06', // Wed
      '2024-03-11', // Mon
      '2024-03-13', // Wed
    ])
    expect(occ.every((e) => e._recurringMasterId === 'r')).toBe(true)
  })

  it('until is an inclusive upper bound (RFC 5545)', () => {
    const occ = projectDates([
      master({ frequency: 'weekly', until: '2024-03-18' }),
    ])
    // 03-18 falls exactly on `until`, so it is included; 03-25 is not.
    expect(occ.map((e) => (e.start as string).slice(0, 10))).toEqual([
      '2024-03-04',
      '2024-03-11',
      '2024-03-18',
    ])
  })

  it('count bounds the total number of occurrences', () => {
    const occ = projectDates([master({ frequency: 'weekly', count: 3 })])
    expect(occ.map((e) => e.id)).toEqual(['r', 'r_1', 'r_2'])
    expect(occ.map((e) => (e.start as string).slice(0, 10))).toEqual([
      '2024-03-04',
      '2024-03-11',
      '2024-03-18',
    ])
  })

  it('exDate removes a single occurrence from the master rule', () => {
    const occ = projectDates([
      master({
        frequency: 'weekly',
        count: 4,
        exDates: ['2024-03-11T09:00:00'],
      }),
    ])
    // 03-11 dropped; the rest of the series is untouched.
    expect(occ.map((e) => (e.start as string).slice(0, 10))).toEqual([
      '2024-03-04',
      '2024-03-18',
      '2024-03-25',
    ])
  })

  it('override changes one occurrence while others keep the master time', () => {
    const occ = projectDates([
      master({
        frequency: 'weekly',
        count: 3,
        overrides: [
          {
            originalStart: '2024-03-11T09:00:00',
            start: '2024-03-12T15:00:00',
            end: '2024-03-12T16:00:00',
            title: 'Moved',
          },
        ],
      }),
    ])
    const moved = occ.find((e) => (e.start as string).startsWith('2024-03-12'))!
    expect(moved.start).toBe('2024-03-12T15:00:00')
    expect(moved.title).toBe('Moved')
    expect(moved._occurrenceOriginalStart).toBe('2024-03-11T09:00:00')
    // The untouched occurrences keep the master 09:00 time and 03-11 is gone.
    expect(occ.map((e) => e.start as string)).toEqual([
      '2024-03-04T09:00:00',
      '2024-03-12T15:00:00',
      '2024-03-18T09:00:00',
    ])
  })
})
