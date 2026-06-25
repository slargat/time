import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../core/constructCalendar'
import { eventsFeature } from '../features/eventsFeature'
import { eventCrudFeature } from '../features/eventCrudFeature'
import { historyFeature } from '../features/historyFeature'
import { resizeFeature } from '../features/resizeFeature'
import { timelineFeature } from '../features/timelineFeature'
import { CalendarCore } from '../calendar'
import type { Event, Resource } from '../types'

const jan15: Event = {
  id: 'a',
  title: 'A',
  start: '2024-01-15T10:00:00',
  end: '2024-01-15T11:00:00',
}

describe('feature composition', () => {
  it('exposes core + only the registered feature APIs (no `as const`)', () => {
    const cal = constructCalendar({
      viewMode: { value: 1, unit: 'month' },
      events: [jan15],
      features: { eventsFeature, historyFeature },
    })

    // core (always on)
    expect(typeof cal.goToNextPeriod).toBe('function')
    expect(cal.getDaysNames()).toHaveLength(7)

    // eventsFeature
    expect(cal.getEvents().map((e) => e.id)).toEqual(['a'])
    expect(cal.getEventsByDate('2024-01-15').map((e) => e.id)).toEqual(['a'])

    // historyFeature — only type-checks because historyFeature is registered
    expect(cal.canUndo()).toBe(false)
    cal.undo()
  })

  it('omits a feature API when its key is absent', () => {
    const cal = constructCalendar({
      viewMode: { value: 1, unit: 'month' },
      features: { eventsFeature },
    })
    // @ts-expect-error `undo` is not on the instance without historyFeature
    cal.undo
    expect(cal.getEvents()).toEqual([])
  })

  it('populates getDays() with each day’s events', () => {
    const cal = constructCalendar({
      viewMode: { value: 1, unit: 'month' },
      events: [jan15],
      features: { eventsFeature },
    })
    cal.goToSpecificPeriod('2024-01-15')
    const day = cal.getDays().find((d) => d.isoDate === '2024-01-15')
    expect(day?.events.map((e) => e.id)).toEqual(['a'])
  })

  it('matches CalendarCore for recurring + multi-day events (data-layer parity)', () => {
    const events: Array<Event> = [
      jan15,
      {
        id: 'weekly',
        title: 'Weekly',
        start: '2024-01-01T09:00:00',
        end: '2024-01-01T10:00:00',
        recurrence: { frequency: 'weekly' },
      },
      {
        id: 'multi',
        title: 'Multi-day',
        start: '2024-01-10T22:00:00',
        end: '2024-01-12T02:00:00',
      },
    ]
    const opts = {
      viewMode: { value: 1, unit: 'month' as const },
      events,
      timeZone: 'UTC',
    }
    const core = new CalendarCore(opts)
    const cal = constructCalendar({ ...opts, features: { eventsFeature } })
    core.goToSpecificPeriod('2024-01-15')
    cal.goToSpecificPeriod('2024-01-15')

    const byDayCore = core
      .getDaysWithEvents()
      .map((d) => [d.isoDate, d.events.map((e) => e.id).sort()] as const)
    const byDayNew = cal
      .getDays()
      .map((d) => [d.isoDate, d.events.map((e) => e.id).sort()] as const)
    expect(byDayNew).toEqual(byDayCore)

    for (const date of ['2024-01-08', '2024-01-11', '2024-01-15']) {
      expect(cal.getEventsByDate(date).map((e) => e.id).sort()).toEqual(
        core.getEventsByDate(date).map((e) => e.id).sort(),
      )
    }
  })

  it('returns event nodes carrying eventsFeature prototype methods', () => {
    const cal = constructCalendar({
      viewMode: { value: 1, unit: 'month' },
      events: [jan15],
      features: { eventsFeature },
    })
    cal.goToSpecificPeriod('2024-01-15')
    const day = cal.getDays().find((d) => d.isoDate === '2024-01-15')
    const node = day?.events[0]
    expect(node?.id).toBe('a')
    // methods live on the shared prototype, bound via `this`
    expect(typeof node?.getProps).toBe('function')
    expect(node?.getProps().isSplitEvent).toBe(false)
    expect(node?.getSegmentInfo().isSplitEvent).toBe(false)
  })

  it('resize contributes event/day node methods + the controller', () => {
    const cal = constructCalendar({
      viewMode: { value: 1, unit: 'day' },
      events: [jan15],
      timeZone: 'UTC',
      resize: { constraints: { snapToMinutes: 15, minDurationMinutes: 15 } },
      features: { eventsFeature, resizeFeature, historyFeature },
    })
    cal.goToSpecificPeriod('2024-01-15')

    const day = cal.getDays()[0]
    const node = day?.events[0]
    // resize node methods present only because resizeFeature is registered
    expect(typeof node?.getResizeHandleProps).toBe('function')
    expect(typeof node?.getResizeHandleProps('bottom').onMouseDown).toBe(
      'function',
    )
    expect(typeof day?.getColumnProps).toBe('function')
    expect(typeof day?.getColumnProps().ref).toBe('function')
    // events-feature node methods coexist on the same prototype
    expect(typeof node?.getProps).toBe('function')
    expect(cal.getResizeState().isResizing).toBe(false)
  })

  it('omits resize node methods when resizeFeature is absent', () => {
    const cal = constructCalendar({
      viewMode: { value: 1, unit: 'day' },
      events: [jan15],
      features: { eventsFeature },
    })
    cal.goToSpecificPeriod('2024-01-15')
    const node = cal.getDays()[0]?.events[0]
    // @ts-expect-error getResizeHandleProps requires resizeFeature
    node?.getResizeHandleProps
    expect(
      (node as unknown as Record<string, unknown>).getResizeHandleProps,
    ).toBe(undefined)
  })

  it('matches CalendarCore for resources/availability (timeline parity)', () => {
    const resource: Resource = {
      id: 'r1',
      label: 'Room',
      availability: [
        { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
      ],
      capacity: [5],
    }
    const events: Array<Event> = [
      {
        id: 'daily',
        title: 'Daily',
        start: '2024-01-01T10:00:00',
        end: '2024-01-01T11:00:00',
        recurrence: { frequency: 'daily' },
        resources: ['r1'],
      },
    ]
    const opts = {
      viewMode: { value: 1, unit: 'month' as const },
      events,
      resources: [resource],
      timeZone: 'UTC',
    }
    const core = new CalendarCore(opts)
    const cal = constructCalendar({
      ...opts,
      features: { eventsFeature, timelineFeature },
    })
    core.goToSpecificPeriod('2024-01-15')
    cal.goToSpecificPeriod('2024-01-15')

    // unavailable pixel ranges
    expect(cal.getUnavailableRanges('2024-01-15', { containerHeight: 1440 })).toEqual(
      core.getUnavailableRanges('2024-01-15', { containerHeight: 1440 }),
    )

    // placement validation (20:00 is outside 09:00–17:00 → blocked)
    const candidate = {
      title: 'X',
      start: '2024-01-15T20:00:00',
      end: '2024-01-15T21:00:00',
      resources: ['r1'],
    }
    expect(cal.validateEventPlacement(candidate)).toEqual(
      core.validateEventPlacement(candidate),
    )

    // occurrence gate: weekend occurrences dropped (resource unavailable)
    const byDayNew = cal
      .getDays()
      .map((d) => [d.isoDate, d.events.map((e) => e.id)] as const)
    const byDayCore = core
      .getDaysWithEvents()
      .map((d) => [d.isoDate, d.events.map((e) => e.id)] as const)
    expect(byDayNew).toEqual(byDayCore)
    // sanity: at least one weekday kept and one weekend dropped
    const kept = byDayNew.filter(([, ids]) => ids.includes('daily')).length
    expect(kept).toBeGreaterThan(0)
    expect(kept).toBeLessThan(byDayNew.length)

    // events grouped by resource
    expect(
      cal.getEventsByResource().get('r1')?.map((e) => e.id).sort(),
    ).toEqual(core.getEventsByResource().get('r1')?.map((e) => e.id).sort())
  })

  it('crud mutates the shared map and feeds history undo/redo', async () => {
    const cal = constructCalendar({
      viewMode: { value: 1, unit: 'month' },
      events: [] as Array<Event>,
      features: { eventsFeature, eventCrudFeature, historyFeature },
    })

    await cal.addEvent(jan15)
    expect(cal.getEvents().map((e) => e.id)).toEqual(['a'])
    expect(cal.canUndo()).toBe(true)

    await cal.editEvent('a', { title: 'A2' })
    expect(cal.getEvents()[0]?.title).toBe('A2')

    cal.undo() // revert edit
    expect(cal.getEvents()[0]?.title).toBe('A')
    cal.undo() // revert add
    expect(cal.getEvents()).toEqual([])

    cal.redo() // re-add
    expect(cal.getEvents().map((e) => e.id)).toEqual(['a'])

    cal.removeEvent('a')
    expect(cal.getEvents()).toEqual([])
  })
})
