import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { toPlainDateTimeString } from '../../date-utils'
import { dependenciesFeature } from './dependencies-feature'
import { epochMs } from './dependencies-feature.utils'
import type { Event } from '../../types'

const june = { currentPeriod: Temporal.PlainDate.from('2024-06-01') }

// B finish-to-start after A (B can't start before A ends).
const chain = (): Array<Event> => [
  { id: 'A', title: 'A', start: '2024-06-12T09:00', end: '2024-06-12T10:00' },
  {
    id: 'B',
    title: 'B',
    start: '2024-06-12T10:00',
    end: '2024-06-12T11:00',
    dependsOn: [{ id: 'A', type: 'FS' }],
  },
]

const byId = (calendar: { getEvents: () => Array<Event> }, id: string) =>
  calendar.getEvents().find((e) => e.id === id)!

describe('dependenciesFeature', () => {
  it('cascades a dependent forward when its predecessor moves', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, dependenciesFeature },
      events: chain(),
      initialState: june,
    })

    // push A two hours later → B must follow to stay after A's end
    calendar.updateEvent('A', {
      start: '2024-06-12T11:00',
      end: '2024-06-12T12:00',
    })

    const b = byId(calendar, 'B')
    expect(b.start).toBe('2024-06-12T12:00:00')
    expect(b.end).toBe('2024-06-12T13:00:00')
  })


  // FS cascade preserves the real-time (instant) relationship across a DST gap.
  // NY spring-forward 2024: Sun Mar 10, 02:00 -> 03:00. Moving A so B's forward
  // shift spans the gap must keep B.start at A's end INSTANT, not an hour off.
  it('keeps an FS successor at the predecessor end instant across spring-forward DST', () => {
    const tz = 'America/New_York'
    // A ends where B starts — same instant, FS satisfied.
    const dstChain = (): Array<Event> => [
      { id: 'A', title: 'A', start: '2024-03-09T23:00', end: '2024-03-10T00:00' },
      {
        id: 'B',
        title: 'B',
        start: '2024-03-10T00:00',
        end: '2024-03-10T01:00',
        dependsOn: [{ id: 'A', type: 'FS' }],
      },
    ]
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, dependenciesFeature },
      events: dstChain(),
      initialState: { currentPeriod: Temporal.PlainDate.from('2024-03-01') },
      timeZone: tz,
    })

    // Move A across the gap (ends at 06:00 EDT). B must follow to A's end instant.
    calendar.updateEvent('A', {
      start: '2024-03-10T05:00',
      end: '2024-03-10T06:00',
    })

    const a = byId(calendar, 'A')
    const b = byId(calendar, 'B')
    // Real-time gap between A.end and B.start is exactly zero.
    expect(epochMs(toPlainDateTimeString(b.start), tz)).toBe(
      epochMs(toPlainDateTimeString(a.end), tz),
    )
    // Instant-domain result (wall would be the buggy 05:00 -> an hour early).
    expect(b.start).toBe('2024-03-10T06:00:00')
  })

  // Parallel non-DST move: no gap to cross, so wall-clock and instant agree.
  it('keeps an FS successor at the predecessor end instant with no DST boundary', () => {
    const tz = 'America/New_York'
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, dependenciesFeature },
      events: chain(),
      initialState: june,
      timeZone: tz,
    })

    calendar.updateEvent('A', { start: '2024-06-12T14:00', end: '2024-06-12T15:00' })

    const a = byId(calendar, 'A')
    const b = byId(calendar, 'B')
    expect(epochMs(toPlainDateTimeString(b.start), tz)).toBe(
      epochMs(toPlainDateTimeString(a.end), tz),
    )
    expect(b.start).toBe('2024-06-12T15:00:00')
  })
})
