import { describe, expect, test } from 'vitest'
import { buildEventAttributes } from './getEventProps'
import type { Event } from './types'

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    title: 'Standup',
    start: '2026-06-17T09:00:00',
    end: '2026-06-17T09:30:00',
    ...overrides,
  }
}

describe('buildEventAttributes', () => {
  test('emits id and defaults for a plain timed event', () => {
    expect(buildEventAttributes(makeEvent())).toEqual({
      'data-event-id': 'e1',
      'data-all-day': false,
      'data-split': false,
    })
  })

  test('flags all-day events', () => {
    expect(buildEventAttributes(makeEvent({ allDay: true }))['data-all-day']).toBe(
      true,
    )
  })

  test('flags split segments via _originalStart/_originalEnd', () => {
    const segment = makeEvent({ _originalStart: '2026-06-16T09:00:00' })
    expect(buildEventAttributes(segment)['data-split']).toBe(true)
  })

  test('resolves first resource id from string or object resources', () => {
    expect(
      buildEventAttributes(makeEvent({ resources: ['r1'] }))['data-resource'],
    ).toBe('r1')
    expect(
      buildEventAttributes(
        makeEvent({ resources: [{ id: 'r2', label: 'Room 2' }] }),
      )['data-resource'],
    ).toBe('r2')
  })

  test('omits data-resource when no resources', () => {
    expect(buildEventAttributes(makeEvent())).not.toHaveProperty(
      'data-resource',
    )
  })
})
