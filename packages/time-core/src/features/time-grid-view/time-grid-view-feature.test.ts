import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { timeGridViewFeature } from './time-grid-view-feature'

const day = (events: Array<any>, unit: 'week' | 'day' | 'workWeek') =>
  constructCalendar({
    features: { timeGridViewFeature },
    events,
    initialState: {
      viewMode: { value: 1, unit },
      currentPeriod: Temporal.PlainDate.from('2026-06-27'),
    },
  })

describe('timeGridViewFeature', () => {
  it('builds 1 column for day, 7 for week, over a 24h axis', () => {
    const d = day([], 'day').getView()
    expect(d.days).toHaveLength(1)
    expect(d.timeSlots).toHaveLength(24)

    // week: 7 cols, aligned to weekStartsOn (default Monday) even though
    // currentPeriod (2026-06-27) is a Saturday — picking any day in the week
    // shows the same period, not a window starting on the picked day.
    const w = day([], 'week').getView()
    expect(w.days).toHaveLength(7)
    expect(w.days[0]!.date.dayOfWeek).toBe(1) // Monday
    expect(w.days[6]!.date.dayOfWeek).toBe(7) // Sunday

    // workWeek: Mon–Fri (5 cols), aligned to the Monday of currentPeriod's week.
    const ww = day([], 'workWeek').getView()
    expect(ww.days).toHaveLength(5)
    expect(ww.days[0]!.date.dayOfWeek).toBe(1) // Monday
    expect(ww.days[4]!.date.dayOfWeek).toBe(5) // Friday
  })

  it('positions an event by time: top=start%, height=duration%', () => {
    // 06:00–07:00 → top 25% (6/24), height ~4.166% (1/24)
    const view = day(
      [{ id: 'e1', title: 'A', start: '2026-06-27T06:00', end: '2026-06-27T07:00' }],
      'day',
    ).getView()
    const { style } = view.days[0]!.events[0]!.getEventProps()
    expect(style).toBeDefined()
    expect(style!.top).toBe('25%')
    expect(parseFloat(style!.height)).toBeCloseTo((1 / 24) * 100, 5)
    expect(style!.left).toBe('0%')
    expect(style!.width).toBe('100%')
  })

  it('splits two overlapping events into side-by-side columns', () => {
    const view = day(
      [
        { id: 'a', title: 'A', start: '2026-06-27T09:00', end: '2026-06-27T10:00' },
        { id: 'b', title: 'B', start: '2026-06-27T09:30', end: '2026-06-27T10:30' },
      ],
      'day',
    ).getView()
    const [a, b] = view.days[0]!.events
    // earlier start (a) sits in the left column, each half width
    expect(a!.getEventProps().style!.width).toBe('50%')
    expect(a!.getEventProps().style!.left).toBe('0%')
    expect(b!.getEventProps().style!.left).toBe('50%')
  })

  it('marks a multi-day day-segment as split and reports the full span', () => {
    // Spans two days → getProjectedDays splits it into per-day segments, each
    // carrying _originalStart/_originalEnd.
    const view = day(
      [
        {
          id: 'm',
          title: 'Multi',
          start: '2026-06-27T22:00',
          end: '2026-06-28T02:00',
        },
      ],
      'week',
    ).getView()

    const segments = view.days.flatMap((d) =>
      d.events.filter((e) => e.id === 'm'),
    )
    expect(segments.length).toBe(2) // one segment per covered day

    for (const seg of segments) {
      const props = seg.getEventProps()
      expect(props.isSplitEvent).toBe(true)
      // full span, not the clipped per-day segment times
      expect(props.start).toBe('2026-06-27T22:00:00')
      expect(props.end).toBe('2026-06-28T02:00:00')
    }
  })

  it('does not mark a whole single-day event as split', () => {
    const view = day(
      [{ id: 's', title: 'Single', start: '2026-06-27T09:00', end: '2026-06-27T10:00' }],
      'day',
    ).getView()
    expect(view.days[0]!.events[0]!.getEventProps().isSplitEvent).toBe(false)
  })
})
