import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { monthViewFeature } from '../../features/month-view/month-view-feature'
import { constructCalendar } from './construct-calendar'
import type { CalendarFeature } from '../../types/calendar-features'

describe('constructCalendar', () => {
  it('builds the active view model and navigates the viewport', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [],
    })

    expect(calendar.getView()).toMatchObject({ view: 'month' })

    const before = calendar.store.state.currentPeriod.toString()
    calendar.goToNextPeriod()
    expect(calendar.store.state.currentPeriod.toString()).not.toBe(before)
  })

  it('projects in-window events onto their day and clips the rest', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [
        { id: 'in', title: 'In', start: '2024-06-12T09:00', end: '2024-06-12T10:00' },
        { id: 'out', title: 'Out', start: '2023-01-01T09:00', end: '2023-01-01T10:00' },
      ],
      initialState: { currentPeriod: Temporal.PlainDate.from('2024-06-01') },
    })

    const ids = calendar
      .getProjectedDays()
      .flatMap((day) => day.events.map((event) => event.id))
    expect(ids).toEqual(['in']) // 'out' clipped to the viewport window

    const view = calendar.getView()
    const target = view.weeks
      .flatMap((week) => week.days)
      .find((day) => day?.isoDate === '2024-06-12')
    expect(target?.events.map((e) => e.id)).toEqual(['in'])
  })

  it('splits a multi-day event across each day it covers', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [
        {
          id: 'm',
          title: 'Conference',
          start: '2024-06-12T09:00',
          end: '2024-06-13T17:00',
        },
      ],
      initialState: { currentPeriod: Temporal.PlainDate.from('2024-06-01') },
    })

    const onDay = (iso: string) =>
      calendar
        .getProjectedDays()
        .find((day) => day.isoDate === iso)
        ?.events.map((e) => e.id) ?? []

    expect(onDay('2024-06-12')).toEqual(['m'])
    expect(onDay('2024-06-13')).toEqual(['m']) // segment on the second day too
    expect(onDay('2024-06-14')).toEqual([])
  })

  it('routes all-day events to the allDayEvents bucket', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [
        {
          id: 'ad',
          title: 'Holiday',
          start: '2024-06-12T00:00',
          end: '2024-06-12T23:59',
          allDay: true,
        },
      ],
      initialState: { currentPeriod: Temporal.PlainDate.from('2024-06-01') },
    })

    const day = calendar
      .getProjectedDays()
      .find((d) => d.isoDate === '2024-06-12')!
    expect(day.events).toEqual([])
    expect(day.allDayEvents.map((e) => e.id)).toEqual(['ad'])
  })

  it('memoizes getProjectedDays until a dep (period) changes', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [],
      initialState: { currentPeriod: Temporal.PlainDate.from('2024-06-01') },
    })
    expect(calendar.getProjectedDays()).toBe(calendar.getProjectedDays())
    const first = calendar.getProjectedDays()
    calendar.goToNextPeriod()
    expect(calendar.getProjectedDays()).not.toBe(first)
  })

  it('throws when no registered View matches the viewMode', () => {
    const calendar = constructCalendar({ features: {}, events: [] })
    expect(() => calendar.getView()).toThrow(/no registered View/)
  })

  it('rejects two features owning the same pipeline stage (single-owner)', () => {
    const a: CalendarFeature = { projection: { clip: (ctx) => ctx } }
    const b: CalendarFeature = { projection: { clip: (ctx) => ctx } }
    expect(() =>
      // custom (unregistered) features — cast past the typed registry
      constructCalendar({ features: { a, b } as any, events: [] }),
    ).toThrow(/single-owner/)
  })
})
