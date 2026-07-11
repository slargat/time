import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { recurrenceFeature } from '../recurrence/recurrence-feature'
import { availabilityFeature } from './availability-feature'
import type { Event, Resource, ViewMode } from '../../types'

// Ported from packages/time calendar.test.ts (availability + capacity), driven
// through time-core's createEvent veto and recurring-occurrence filtering.
// 2024-03-18 is a Monday, UTC.
const MON = '2024-03-18'
const monday = { currentPeriod: Temporal.PlainDate.from(MON) }
const week = {
  currentPeriod: Temporal.PlainDate.from(MON),
  viewMode: { value: 1, unit: 'week' } as ViewMode,
}

describe('availability parity', () => {
  it('vetoes a write that exceeds capacity by multi-unit consumption', async () => {
    // Room has 3 units; events consume more than one unit each.
    const room: Resource = {
      id: 'r1',
      label: 'Room',
      availability: [
        { weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' },
      ],
      capacity: [3],
    }
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, availabilityFeature },
      events: [] as Array<Event>,
      resources: [room],
      initialState: monday,
    })

    expect(
      await calendar.createEvent({
        id: 'a',
        title: 'A',
        start: `${MON}T09:00`,
        end: `${MON}T10:00`,
        resources: ['r1'],
        consumption: [2],
      }),
    ).toEqual({ success: true })

    // 2 + 2 = 4 > 3 → rejected.
    expect(
      (
        await calendar.createEvent({
          id: 'b',
          title: 'B',
          start: `${MON}T09:30`,
          end: `${MON}T10:30`,
          resources: ['r1'],
          consumption: [2],
        })
      ).success,
    ).toBe(false)

    // 2 + 1 = 3 = capacity → allowed.
    expect(
      await calendar.createEvent({
        id: 'c',
        title: 'C',
        start: `${MON}T09:30`,
        end: `${MON}T10:30`,
        resources: ['r1'],
        consumption: [1],
      }),
    ).toEqual({ success: true })

    expect(calendar.getEvents().map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('honors two availability windows in one day (lunch gap)', async () => {
    const room: Resource = {
      id: 'r1',
      label: 'Room',
      availability: [
        { weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '12:00' },
        { weekdays: [1, 2, 3, 4, 5], startTime: '13:00', endTime: '17:00' },
      ],
    }
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, availabilityFeature },
      events: [] as Array<Event>,
      resources: [room],
      initialState: monday,
    })

    const morning = await calendar.createEvent({
      id: 'morning',
      title: 'Morning',
      start: `${MON}T09:00`,
      end: `${MON}T10:00`,
      resources: ['r1'],
    })
    // 12:00–13:00 falls in the gap between the two windows → vetoed.
    const lunch = await calendar.createEvent({
      id: 'lunch',
      title: 'Lunch',
      start: `${MON}T12:00`,
      end: `${MON}T13:00`,
      resources: ['r1'],
    })
    const afternoon = await calendar.createEvent({
      id: 'afternoon',
      title: 'Afternoon',
      start: `${MON}T14:00`,
      end: `${MON}T15:00`,
      resources: ['r1'],
    })

    expect(morning).toEqual({ success: true })
    expect(lunch.success).toBe(false)
    expect(afternoon).toEqual({ success: true })
    expect(calendar.getEvents().map((e) => e.id)).toEqual([
      'morning',
      'afternoon',
    ])
  })

  it('combines availability across an event’s resources when filtering occurrences', () => {
    // r1 open Mon–Fri, r2 open Mon–Wed only. A daily occurrence assigned to both
    // survives only where BOTH resources are available.
    const r1: Resource = {
      id: 'r1',
      label: 'Room 1',
      availability: [
        { weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' },
      ],
    }
    const r2: Resource = {
      id: 'r2',
      label: 'Room 2',
      availability: [
        { weekdays: [1, 2, 3], startTime: '08:00', endTime: '18:00' },
      ],
    }
    const calendar = constructCalendar({
      features: { recurrenceFeature, availabilityFeature },
      events: [
        {
          id: 'r',
          title: 'Daily',
          start: `${MON}T09:00`,
          end: `${MON}T10:00`,
          resources: ['r1', 'r2'],
          recurrence: { frequency: 'daily', count: 7 },
        },
      ],
      resources: [r1, r2],
      initialState: week,
    })

    // Mon–Sun expanded (7); Thu/Fri drop (r2 closed), weekend drops (both) → 3.
    expect(
      calendar.getProjectedEvents().map((e) => e.start.slice(0, 10)),
    ).toEqual(['2024-03-18', '2024-03-19', '2024-03-20'])
  })
})
