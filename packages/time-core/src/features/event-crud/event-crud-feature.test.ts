import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { monthViewFeature } from '../month-view/month-view-feature'
import { eventCrudFeature } from './event-crud-feature'
import type { CalendarFeature } from '../../types/calendar-features'
import type { Event } from '../../types'

const june = { currentPeriod: Temporal.PlainDate.from('2024-06-01') }
const evt = (id: string): Event => ({
  id,
  title: id,
  start: '2024-06-12T09:00',
  end: '2024-06-12T10:00',
})
const noEvents: Array<Event> = []

describe('eventCrudFeature', () => {
  it('commits a create through the write pipeline, replacing the events slice', async () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature },
      events: noEvents,
      initialState: june,
    })

    const before = calendar.store.state.events
    const result = await calendar.createEvent(evt('a'))

    expect(result).toEqual({ success: true })
    expect(calendar.getEvents().map((e) => e.id)).toEqual(['a'])
    expect(calendar.store.state.events).not.toBe(before) // new array ref
    // projected onto its day
    const ids = calendar
      .getProjectedDays()
      .flatMap((day) => day.events.map((e) => e.id))
    expect(ids).toEqual(['a'])
  })

  it('updates and removes by id (no-op success for unknown ids)', async () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature },
      events: [evt('a')],
      initialState: june,
    })

    await calendar.updateEvent('a', { title: 'renamed' })
    expect(calendar.getEvents()[0]).toMatchObject({ id: 'a', title: 'renamed' })

    expect(await calendar.updateEvent('ghost', { title: 'x' })).toEqual({
      success: true,
    })

    await calendar.removeEvent('a')
    expect(calendar.getEvents()).toEqual([])
    expect(await calendar.removeEvent('ghost')).toEqual({ success: true })
  })

  it('a veto stage rejects the batch before commit, leaving the collection untouched', async () => {
    const busyFeature: CalendarFeature = {
      write: {
        availabilityValidate: (batch) => ({
          ...batch,
          rejected: { reason: 'resource busy' },
        }),
      },
    }
    // custom (unregistered) feature — cast past the typed registry, like the
    // single-owner test does; access stays typed via the known-good shape.
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, busyFeature } as unknown as {
        monthViewFeature: CalendarFeature
        eventCrudFeature: CalendarFeature
      },
      events: noEvents,
      initialState: june,
    })

    const before = calendar.store.state.events
    const result = await calendar.createEvent(evt('a'))

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.message).toBe('resource busy')
    expect(calendar.getEvents()).toEqual([]) // commit never ran
    expect(calendar.store.state.events).toBe(before) // slice untouched
  })
})
