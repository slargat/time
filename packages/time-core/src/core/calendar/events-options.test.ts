import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { monthViewFeature } from '../../features/month-view/month-view-feature'
import { eventCrudFeature } from '../../features/event-crud/event-crud-feature'
import { recurrenceFeature } from '../../features/recurrence/recurrence-feature'
import { availabilityFeature } from '../../features/timeline/availability-feature'
import { calendar_dispatchWrite } from '../../pipeline/dispatch-write'
import { constructCalendar } from './construct-calendar'
import type { Calendar_Internal } from '../../types/calendar'
import type { Event, Resource } from '../../types'

const june = { currentPeriod: Temporal.PlainDate.from('2024-06-01') }
const evt = (id: string, start = '2024-06-12T09:00'): Event => ({
  id,
  title: id,
  start,
  end: '2024-06-12T10:00',
})

describe('events ownership + setOptions invalidation', () => {
  it('seeds and normalizes events from options.events (uncontrolled)', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [{ ...evt('a'), start: new Date(Date.UTC(2024, 5, 12, 9, 0, 0)) }],
      initialState: june,
    })
    // absolute Date input normalized to a wall-time string at ingestion.
    expect(calendar.getEvents()[0]!.start).toBe('2024-06-12T09:00:00')
  })

  it('does NOT clobber internal mutations when options.events ref is stable', async () => {
    const seed = [evt('a')]
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature },
      events: seed,
      initialState: june,
    })
    await calendar.createEvent(evt('b'))
    // a re-render with the SAME options.events reference must not wipe 'b'.
    calendar.setOptions((prev) => ({ ...prev, events: seed }))
    expect(calendar.getEvents().map((e) => e.id).sort()).toEqual(['a', 'b'])
  })

  it('re-syncs when a controlled consumer feeds a NEW options.events ref', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [evt('a')],
      initialState: june,
    })
    expect(calendar.getEvents().map((e) => e.id)).toEqual(['a'])

    calendar.setOptions((prev) => ({ ...prev, events: [evt('a'), evt('c')] }))
    expect(calendar.getEvents().map((e) => e.id)).toEqual(['a', 'c'])
  })

  it('a new options.events reference invalidates the projection memo', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [evt('a')],
      initialState: june,
    })
    const idsOnDay = () =>
      calendar.getProjectedDays().flatMap((d) => d.events.map((e) => e.id))
    expect(idsOnDay()).toEqual(['a'])

    calendar.setOptions((prev) => ({ ...prev, events: [evt('a'), evt('c')] }))
    expect(idsOnDay().sort()).toEqual(['a', 'c'])
  })

  it('clears availability caches when options.resources changes', () => {
    const busy: Array<Resource> = [
      { id: 'r1', label: 'R1', availability: [] }, // no windows ⇒ always unavailable
    ]
    const recurringOnR1: Event = {
      ...evt('rec'),
      resources: ['r1'],
      recurrence: { frequency: 'daily' },
    }
    const calendar = constructCalendar({
      features: { monthViewFeature, availabilityFeature, recurrenceFeature },
      events: [recurringOnR1],
      resources: busy,
      initialState: june,
    })
    // filtered out while r1 is fully unavailable.
    expect(calendar.getProjectedEvents().length).toBe(0)

    // widen availability → cache must be dropped so the occurrences reappear.
    calendar.setOptions((prev) => ({
      ...prev,
      resources: [
        { id: 'r1', label: 'R1', availability: [{ weekdays: [1, 2, 3, 4, 5, 6, 7], startTime: '00:00', endTime: '23:59' }] },
      ],
    }))
    expect(calendar.getProjectedEvents().length).toBeGreaterThan(0)
  })
})

describe('commit-stage guard', () => {
  it('throws when a write is dispatched with no commit owner (no eventCrudFeature)', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, recurrenceFeature },
      events: [] as Array<Event>,
      initialState: june,
    })
    expect(() =>
      calendar_dispatchWrite(calendar as unknown as Calendar_Internal<any, any, any>, [
        { kind: 'create', event: evt('a') },
      ]),
    ).toThrow(/commit/)
  })
})
