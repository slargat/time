import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { resizeFeature } from '../resize/resize-feature'
import { timelineViewFeature } from './timeline-view-feature'

describe('timelineViewFeature', () => {
  it('builds a lane per resource over a time axis when timeline is active', () => {
    const resources = [
      { id: 'r1', label: 'Room A' },
      { id: 'r2', label: 'Room B' },
      { id: 'r3', label: 'Projector' },
    ]
    const calendar = constructCalendar({
      features: { timelineViewFeature },
      events: [],
      resources,
      initialState: { viewMode: { value: 1, unit: 'timeline' } },
    })

    const view = calendar.getView()
    expect(view.view).toBe('timeline')

    expect(view.lanes).toHaveLength(resources.length)
    expect(view.lanes.map((l) => l.resource.id)).toEqual(['r1', 'r2', 'r3'])
    expect(view.timeSlots).toHaveLength(24) // default 0–24, hourly
    expect(view.timeSlots[0]).toMatchObject({ hour: 0, minute: 0 })
  })

  it('groups events into their resource lanes by id', () => {
    const calendar = constructCalendar({
      features: { timelineViewFeature },
      resources: [
        { id: 'r1', label: 'Room A' },
        { id: 'r2', label: 'Room B' },
      ],
      events: [
        { id: 'e1', title: 'A', start: '2026-06-27T09:00', end: '2026-06-27T10:00', resources: ['r1'] },
        { id: 'e2', title: 'B', start: '2026-06-27T11:00', end: '2026-06-27T12:00', resources: ['r2'] },
        { id: 'e3', title: 'C', start: '2026-06-27T13:00', end: '2026-06-27T14:00', resources: ['r1'] },
      ],
      // Pin the viewport to the events' day so the 1-day timeline window
      // includes them regardless of the system clock.
      initialState: {
        viewMode: { value: 1, unit: 'timeline' },
        currentPeriod: Temporal.PlainDate.from('2026-06-27'),
      },
    })

    const view = calendar.getView()

    expect(view.lanes.map((l) => l.events.map((e) => e.id))).toEqual([
      ['e1', 'e3'],
      ['e2'],
    ])
  })

  it('lane events are real nodes exposing node methods', () => {
    const calendar = constructCalendar({
      features: { timelineViewFeature, resizeFeature },
      resources: [{ id: 'r1', label: 'Room A' }],
      events: [
        { id: 'e1', title: 'A', start: '2026-06-27T09:00', end: '2026-06-27T10:00', resources: ['r1'] },
      ],
      initialState: {
        viewMode: { value: 1, unit: 'timeline' },
        currentPeriod: Temporal.PlainDate.from('2026-06-27'),
      },
    })

    const laneEvent = calendar.getView().lanes[0]!.events[0]!
    // a bare projected object would not have the prototype's node methods
    expect(typeof laneEvent.getResizeHandleProps).toBe('function')
    expect(laneEvent.getResizeHandleProps('right')).toHaveProperty('onMouseDown')
  })
})
