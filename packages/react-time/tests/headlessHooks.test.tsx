import * as React from 'react'
import { memo } from 'react'
import { act, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  CalendarProvider,
  useCalendar,
  useCalendarContext,
  useCalendarNavigation,
  useEvent,
  useMonthGrid,
  useScheduleGrid,
} from '../src'
import type { Event, Resource } from '@tanstack/time'
import type { ReactNode } from 'react'
import type { UseCalendarReturn } from '../src'

const { emitSpy } = vi.hoisted(() => ({ emitSpy: vi.fn() }))
vi.mock('@tanstack/time', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/time')>()
  return {
    ...actual,
    getTimeClient: () => ({ emit: emitSpy }),
  }
})

type TestEvent = Event<Resource>

function makeWrapper(
  apiRef?: { current: UseCalendarReturn<Resource, TestEvent> | null },
  events: Array<TestEvent> = [],
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const calendar = useCalendar<Resource, TestEvent>({
      viewMode: { value: 1, unit: 'month' },
      timeZone: 'UTC',
      locale: 'en-US',
      events,
    })
    if (apiRef) apiRef.current = calendar
    return <CalendarProvider value={calendar}>{children}</CalendarProvider>
  }
}

afterEach(() => {
  emitSpy.mockClear()
})

describe('useCalendarContext', () => {
  test('throws when used outside a provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      renderHook(() => useCalendarContext()),
    ).toThrow(/within a <CalendarProvider>/)
    spy.mockRestore()
  })
})

describe('useMonthGrid', () => {
  test('produces full weeks of 7 days and day prop attributes', () => {
    const { result } = renderHook(() => useMonthGrid(), {
      wrapper: makeWrapper(),
    })

    expect(result.current.weeks.length).toBeGreaterThanOrEqual(4)
    for (const week of result.current.weeks) {
      expect(week).toHaveLength(7)
    }
    expect(result.current.dayNames).toHaveLength(7)

    const firstRealDay = result.current.weeks.flat().find((d) => d !== null)!
    const dayProps = result.current.getDayProps(firstRealDay)
    expect(dayProps['data-iso']).toBe(firstRealDay.isoDate)
    expect(dayProps.key).toBe(firstRealDay.isoDate)
    expect(typeof dayProps['data-weekend']).toBe('boolean')
  })
})

describe('useEvent', () => {
  test('resolves an event by id and reflects edits', async () => {
    const apiRef = { current: null as UseCalendarReturn<Resource, TestEvent> | null }
    const event: TestEvent = {
      id: 'e1',
      title: 'Standup',
      start: '2026-06-16T09:00:00',
      end: '2026-06-16T09:30:00',
    }
    const { result } = renderHook(() => useEvent('e1'), {
      wrapper: makeWrapper(apiRef, [event]),
    })

    expect(result.current.event?.title).toBe('Standup')
    expect(result.current.getEventProps()).toMatchObject({
      key: 'e1',
      'data-event-id': 'e1',
    })

    await act(async () => {
      await apiRef.current!.editEvent('e1', { title: 'Daily Standup' })
    })
    expect(result.current.event?.title).toBe('Daily Standup')
  })
})

describe('useScheduleGrid', () => {
  test('exposes time slots, positioned events, and bound prop-getters', () => {
    const event: TestEvent = {
      id: 's1',
      title: 'Focus',
      start: '2026-06-16T09:00:00',
      end: '2026-06-16T10:00:00',
    }
    const Wrapper = function Wrapper({ children }: { children: ReactNode }) {
      const calendar = useCalendar<Resource, TestEvent>({
        viewMode: { value: 1, unit: 'day' },
        timeZone: 'UTC',
        locale: 'en-US',
        events: [event],
      })
      return <CalendarProvider value={calendar}>{children}</CalendarProvider>
    }

    const { result } = renderHook(
      () => useScheduleGrid({ timeSlots: { startHour: 8, endHour: 12 } }),
      { wrapper: Wrapper },
    )

    expect(result.current.timeSlots.length).toBe(4)
    expect(result.current.getDayColumnProps('2026-06-16')).toHaveProperty('ref')

    const eventProps = result.current.getEventProps(event)
    expect(eventProps).toMatchObject({ key: 's1', 'data-event-id': 's1' })
    expect(eventProps.style).toBeDefined()

    const handle = result.current.getResizeHandleProps(
      's1',
      'top',
      event.start as string,
      event.end as string,
    )
    expect(typeof handle.onMouseDown).toBe('function')
  })
})

describe('slice isolation', () => {
  test('adding an event re-renders the grid consumer but not the navigation consumer', async () => {
    const apiRef = { current: null as UseCalendarReturn<Resource, TestEvent> | null }

    const navRenders = { count: 0 }
    const gridRenders = { count: 0 }

    const NavConsumer = memo(function NavConsumer() {
      navRenders.count++
      useCalendarNavigation()
      return null
    })
    const GridConsumer = memo(function GridConsumer() {
      gridRenders.count++
      useMonthGrid()
      return null
    })

    const Wrapper = makeWrapper(apiRef)
    render(
      <Wrapper>
        <NavConsumer />
        <GridConsumer />
      </Wrapper>,
    )

    const navBefore = navRenders.count
    const gridBefore = gridRenders.count

    await act(async () => {
      await apiRef.current!.addEvent({
        id: 'new-1',
        title: 'New',
        start: '2026-06-17T10:00:00',
        end: '2026-06-17T11:00:00',
      })
    })

    expect(gridRenders.count).toBeGreaterThan(gridBefore)
    expect(navRenders.count).toBe(navBefore)
  })
})
