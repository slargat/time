import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../core/constructCalendar'
import { eventsFeature } from '../features/eventsFeature'
import { historyFeature } from '../features/historyFeature'
import type { Event } from '../types'

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
})
