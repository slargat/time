import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { recurrenceFeature } from './recurrence-feature'
import type { Event } from '../../types'

const june = { currentPeriod: Temporal.PlainDate.from('2024-06-01') }
const daily3: Array<Event> = [
  {
    id: 'r',
    title: 'standup',
    start: '2024-06-10T09:00',
    end: '2024-06-10T09:15',
    recurrence: { frequency: 'daily', count: 3 },
  },
]

describe('recurrenceFeature', () => {
  it('expands a recurring master into in-window occurrences', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, recurrenceFeature },
      events: daily3,
      initialState: june,
    })

    const occurrences = calendar.getProjectedEvents()
    expect(occurrences.map((e) => e.id)).toEqual(['r', 'r_1', 'r_2'])
    expect(occurrences.map((e) => (e.start as string).slice(0, 10))).toEqual([
      '2024-06-10',
      '2024-06-11',
      '2024-06-12',
    ])
    // each occurrence points back at its master
    expect(occurrences.every((e) => e._recurringMasterId === 'r')).toBe(true)
  })

  it('does not expand when recurrenceFeature is absent (master only)', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: daily3,
      initialState: june,
    })
    expect(calendar.getProjectedEvents().map((e) => e.id)).toEqual(['r'])
  })

  it('materialize normalizes a recurring rule on create', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, recurrenceFeature, eventCrudFeature },
      events: [] as Array<Event>,
      initialState: june,
    })

    calendar.createEvent({
      id: 'r',
      title: 'standup',
      start: '2024-06-10T09:00',
      end: '2024-06-10T09:15',
      recurrence: {
        frequency: 'weekly',
        // an absolute Date input is normalized to a wall-time string in the
        // calendar's timeZone (default UTC) — deterministic, machine-independent.
        exDates: [new Date(Date.UTC(2024, 5, 17, 9, 0, 0))],
      },
    })

    const stored = calendar.getEvents()[0]!
    expect(typeof stored.recurrence!.exDates![0]).toBe('string')
    expect(stored.recurrence!.exDates![0]).toBe('2024-06-17T09:00:00')
  })
})
