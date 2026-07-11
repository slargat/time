import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { availabilityFeature } from '../timeline/availability-feature'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { dependenciesFeature } from './dependencies-feature'
import type { Event, Resource } from '../../types'

// 2024-03-18 is a Monday. Room open Mon–Fri 08:00–17:00, capacity 1, UTC.
const MON = '2024-03-18'
const room: Resource = {
  id: 'r1',
  label: 'Room',
  availability: [
    { weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '17:00' },
  ],
  capacity: [1],
}
const monday = { currentPeriod: Temporal.PlainDate.from(MON) }
const features = {
  monthViewFeature,
  eventCrudFeature,
  availabilityFeature,
  dependenciesFeature,
}

// B finish-to-start after A (B can't start before A ends).
const chain = (): Array<Event> => [
  {
    id: 'A',
    title: 'A',
    start: `${MON}T09:00`,
    end: `${MON}T10:00`,
    resources: ['r1'],
  },
  {
    id: 'B',
    title: 'B',
    start: `${MON}T10:00`,
    end: `${MON}T11:00`,
    resources: ['r1'],
    dependsOn: [{ id: 'A', type: 'FS' }],
  },
]

const byId = (calendar: { getEvents: () => Array<Event> }, id: string) =>
  calendar.getEvents().find((e) => e.id === id)!

describe('dependenciesFeature — validation APIs', () => {
  it('validateMove blocks a move that pushes a dependent into unavailable time', () => {
    const calendar = constructCalendar({
      features,
      events: chain(),
      resources: [room],
      initialState: monday,
    })

    // Move A to 15:00–16:30 → FS pushes B to 16:30–17:30, past the 17:00 close.
    const result = calendar.validateMove(
      'A',
      `${MON}T15:00`,
      `${MON}T16:30`,
    )
    expect(result.blocked).toBe(true)
    expect(result.blockedEventTitle).toBe('B')
  })

  it('validateMove allows a move that keeps dependents inside availability', () => {
    const calendar = constructCalendar({
      features,
      events: chain(),
      resources: [room],
      initialState: monday,
    })

    // Move A to 11:00–12:00 → B shifts to 12:00–13:00, still within hours.
    expect(
      calendar.validateMove('A', `${MON}T11:00`, `${MON}T12:00`),
    ).toEqual({ blocked: false })
  })

  it('createDependency adds the link and reschedules the target', () => {
    const calendar = constructCalendar({
      features,
      events: [
        {
          id: 'A',
          title: 'A',
          start: `${MON}T09:00`,
          end: `${MON}T10:00`,
          resources: ['r1'],
        },
        {
          id: 'C',
          title: 'C',
          start: `${MON}T09:00`,
          end: `${MON}T10:00`,
          resources: ['r1'],
        },
      ],
      resources: [room],
      initialState: monday,
    })

    const result = calendar.createDependency('A', 'C', 'FS')
    expect(result.blocked).toBe(false)

    const c = byId(calendar, 'C')
    // FS forces C to start at A's end (10:00); 1h duration preserved.
    expect(c.start).toBe(`${MON}T10:00:00`)
    expect(c.end).toBe(`${MON}T11:00:00`)
    expect(c.dependsOn).toEqual([{ id: 'A', type: 'FS' }])
  })

  it('createDependency rejects a circular dependency', () => {
    const calendar = constructCalendar({
      features,
      events: chain(), // B already depends on A
      resources: [room],
      initialState: monday,
    })

    // Make A depend on B → A→B→A cycle.
    const result = calendar.createDependency('B', 'A', 'FS')
    expect(result.blocked).toBe(true)
    expect(result.error?.reason).toBe('blocked')
    expect(result.error?.message).toContain('circular')
    // target A unchanged, no link added
    expect(byId(calendar, 'A').dependsOn).toBeUndefined()
  })
})
