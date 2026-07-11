import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { calculateResizedEvent } from './get-resize-props'
import { resizeFeature } from './resize-feature'
import type { Event } from '../../types'

describe('calculateResizedEvent', () => {
  it('snaps the dragged edge to the interval', () => {
    const r = calculateResizedEvent({
      originalStart: '2024-06-12T09:00:00',
      originalEnd: '2024-06-12T10:00:00',
      edge: 'bottom',
      deltaMinutes: 32, // snaps to 30
      timeZone: 'UTC',
      constraints: { snapToMinutes: 15 },
    })
    expect(r.end).toContain('10:30')
  })

  it('enforces the minimum duration when shrinking', () => {
    const r = calculateResizedEvent({
      originalStart: '2024-06-12T09:00:00',
      originalEnd: '2024-06-12T10:00:00',
      edge: 'bottom',
      deltaMinutes: -120, // would invert; clamps to min
      timeZone: 'UTC',
      constraints: { minDurationMinutes: 15, snapToMinutes: 15 },
    })
    expect(r.durationMinutes).toBe(15)
  })
})

describe('resizeFeature', () => {
  it('wires the controller and adds node handle/column props', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, eventCrudFeature, resizeFeature },
      events: [
        {
          id: 'e1',
          title: 'E',
          start: '2024-06-12T09:00',
          end: '2024-06-12T10:00',
        },
      ] as Array<Event>,
      initialState: { currentPeriod: Temporal.PlainDate.from('2024-06-01') },
    })

    expect(calendar.resizeController).toBeDefined()
    expect(calendar.getResizeState().isResizing).toBe(false)

    const day = calendar
      .getProjectedDays()
      .find((d) => d.isoDate === '2024-06-12')!
    const node = day.events[0] as any
    expect(typeof node.getResizeHandleProps).toBe('function')
    expect(typeof (day as any).getColumnProps).toBe('function')
    // the handle returns an onMouseDown binding
    expect(typeof node.getResizeHandleProps('bottom').onMouseDown).toBe(
      'function',
    )
  })
})
