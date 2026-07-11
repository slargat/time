import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { recurrenceFeature } from '../recurrence/recurrence-feature'
import { availabilityFeature } from './availability-feature'
import type { Event, Resource, ViewMode } from '../../types'

// 2024-03-18 is a Monday. Room is open Mon–Fri 08:00–17:00, capacity 1.
const MON = '2024-03-18'
const room: Resource = {
  id: 'r1',
  label: 'Room',
  availability: [{ weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '17:00' }],
  capacity: [1],
}
const monday = { currentPeriod: Temporal.PlainDate.from(MON) }
const noEvents: Array<Event> = []

describe('availabilityFeature', () => {
  it('vetoes a write that lands outside the resource hours', async () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, availabilityFeature },
      events: noEvents,
      resources: [room],
      initialState: monday,
    })

    expect(
      await calendar.createEvent({
        id: 'ok',
        title: 'Within hours',
        start: `${MON}T09:00`,
        end: `${MON}T10:00`,
        resources: ['r1'],
      }),
    ).toEqual({ success: true })

    const result = await calendar.createEvent({
      id: 'late',
      title: 'After hours',
      start: `${MON}T18:00`,
      end: `${MON}T19:00`,
      resources: ['r1'],
    })
    expect(result.success).toBe(false)
    expect(calendar.getEvents().map((e) => e.id)).toEqual(['ok'])
  })

  it('vetoes a write that exceeds resource capacity', async () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, availabilityFeature },
      events: noEvents,
      resources: [room],
      initialState: monday,
    })

    await calendar.createEvent({
      id: 'a',
      title: 'A',
      start: `${MON}T09:00`,
      end: `${MON}T10:00`,
      resources: ['r1'],
    })
    const result = await calendar.createEvent({
      id: 'b',
      title: 'B (overlaps, capacity 1)',
      start: `${MON}T09:30`,
      end: `${MON}T10:30`,
      resources: ['r1'],
    })
    expect(result.success).toBe(false)
    expect(calendar.getEvents().map((e) => e.id)).toEqual(['a'])
  })

  it('drops recurring occurrences that fall on unavailable days', () => {
    const calendar = constructCalendar({
      features: { recurrenceFeature, availabilityFeature },
      events: [
        {
          id: 'r',
          title: 'Daily',
          start: `${MON}T09:00`,
          end: `${MON}T10:00`,
          resources: ['r1'],
          recurrence: { frequency: 'daily', count: 7 },
        },
      ],
      resources: [room],
      initialState: {
        currentPeriod: Temporal.PlainDate.from(MON),
        viewMode: { value: 1, unit: 'week' } as ViewMode,
      },
    })

    // Mon–Sun expanded (7), weekend (Sat 03-23 / Sun 03-24) filtered out → 5.
    const dates = calendar
      .getProjectedEvents()
      .map((e) => e.start.slice(0, 10))
    expect(dates).toEqual([
      '2024-03-18',
      '2024-03-19',
      '2024-03-20',
      '2024-03-21',
      '2024-03-22',
    ])
  })

  it('is a no-op when no resources are configured', async () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, availabilityFeature },
      events: noEvents,
      initialState: monday,
    })
    expect(
      await calendar.createEvent({
        id: 'x',
        title: 'X',
        start: `${MON}T03:00`,
        end: `${MON}T04:00`,
        resources: ['r1'],
      }),
    ).toEqual({ success: true })
  })
})
