import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { dependenciesFeature } from './dependencies-feature'
import type { Event } from '../../types'

// Dependency-cascade behavioral matrix, ported from @tanstack/time. Covers all
// four link types (FS/SS/FF/SF), forward + backward propagation, and a multi-hop
// chain. Default timeZone is UTC, so the instant-domain cascade math coincides
// with naive wall-clock math (no DST here). Events read back canonicalized to
// seconds-precision wall-time strings.
//
// Shift formula (from dependencies-feature.utils.ts requiredForwardShiftMs):
//   FS: succ.start >= pred.end   SS: succ.start >= pred.start
//   FF: succ.end   >= pred.end   SF: succ.end   >= pred.start
// The successor is shifted (start+end together) by the shortfall; the same
// formula pulls a predecessor earlier when a successor moves before it.

const june = { currentPeriod: Temporal.PlainDate.from('2024-06-01') }

const byId = (calendar: { getEvents: () => Array<Event> }, id: string) =>
  calendar.getEvents().find((e) => e.id === id)!

const build = (events: Array<Event>) =>
  constructCalendar({
    features: { monthViewFeature, eventCrudFeature, dependenciesFeature },
    events,
    initialState: june,
  })

const ev = (
  id: string,
  start: string,
  end: string,
  dependsOn?: Event['dependsOn'],
): Event => ({ id, title: id, start, end, ...(dependsOn ? { dependsOn } : {}) })

describe('dependency cascade matrix — forward propagation (predecessor moves, successor follows)', () => {
  it('FS: successor start snaps to predecessor end', () => {
    const calendar = build([
      ev('A', '2024-06-12T09:00', '2024-06-12T10:00'),
      ev('B', '2024-06-12T10:00', '2024-06-12T11:00', [{ id: 'A', type: 'FS' }]),
    ])
    // push A +2h → B must follow to stay after A's end
    calendar.updateEvent('A', { start: '2024-06-12T11:00', end: '2024-06-12T12:00' })
    const b = byId(calendar, 'B')
    expect(b.start).toBe('2024-06-12T12:00:00')
    expect(b.end).toBe('2024-06-12T13:00:00')
  })

  it('SS: successor start snaps to predecessor start', () => {
    const calendar = build([
      ev('A', '2024-06-12T09:00', '2024-06-12T10:00'),
      ev('B', '2024-06-12T09:00', '2024-06-12T09:30', [{ id: 'A', type: 'SS' }]),
    ])
    calendar.updateEvent('A', { start: '2024-06-12T11:00', end: '2024-06-12T12:00' })
    const b = byId(calendar, 'B')
    // shift = predStart(11:00) - succStart(09:00) = 2h
    expect(b.start).toBe('2024-06-12T11:00:00')
    expect(b.end).toBe('2024-06-12T11:30:00')
  })

  it('FF: successor end snaps to predecessor end', () => {
    const calendar = build([
      ev('A', '2024-06-12T09:00', '2024-06-12T10:00'),
      ev('B', '2024-06-12T09:30', '2024-06-12T10:00', [{ id: 'A', type: 'FF' }]),
    ])
    // A.end -> 12:30
    calendar.updateEvent('A', { start: '2024-06-12T11:00', end: '2024-06-12T12:30' })
    const b = byId(calendar, 'B')
    // shift = predEnd(12:30) - succEnd(10:00) = 2h30
    expect(b.start).toBe('2024-06-12T12:00:00')
    expect(b.end).toBe('2024-06-12T12:30:00')
  })

  it('SF: successor end snaps to predecessor start', () => {
    const calendar = build([
      ev('A', '2024-06-12T09:00', '2024-06-12T10:00'),
      ev('B', '2024-06-12T08:00', '2024-06-12T09:00', [{ id: 'A', type: 'SF' }]),
    ])
    calendar.updateEvent('A', { start: '2024-06-12T11:00', end: '2024-06-12T12:00' })
    const b = byId(calendar, 'B')
    // shift = predStart(11:00) - succEnd(09:00) = 2h
    expect(b.start).toBe('2024-06-12T10:00:00')
    expect(b.end).toBe('2024-06-12T11:00:00')
  })
})

describe('dependency cascade matrix — backward propagation (successor moves earlier, predecessor pulled)', () => {
  it('FS: predecessor end pulled back to successor start', () => {
    const calendar = build([
      ev('A', '2024-06-12T09:00', '2024-06-12T10:00'),
      ev('B', '2024-06-12T10:00', '2024-06-12T11:00', [{ id: 'A', type: 'FS' }]),
    ])
    // move B earlier by 2h → A must be pulled earlier to keep A.end <= B.start
    calendar.updateEvent('B', { start: '2024-06-12T08:00', end: '2024-06-12T09:00' })
    const a = byId(calendar, 'A')
    // pullBack = predEnd(10:00) - succStart(08:00) = 2h → A shifts -2h
    expect(a.start).toBe('2024-06-12T07:00:00')
    expect(a.end).toBe('2024-06-12T08:00:00')
    expect(byId(calendar, 'B').start).toBe('2024-06-12T08:00:00')
  })

  it('SS: predecessor start pulled back to successor start', () => {
    const calendar = build([
      ev('A', '2024-06-12T09:00', '2024-06-12T10:00'),
      ev('B', '2024-06-12T09:00', '2024-06-12T10:00', [{ id: 'A', type: 'SS' }]),
    ])
    calendar.updateEvent('B', { start: '2024-06-12T07:00', end: '2024-06-12T08:00' })
    const a = byId(calendar, 'A')
    // pullBack = predStart(09:00) - succStart(07:00) = 2h → A shifts -2h
    expect(a.start).toBe('2024-06-12T07:00:00')
    expect(a.end).toBe('2024-06-12T08:00:00')
  })
})

describe('dependency cascade matrix — multi-hop chain', () => {
  it('FS: A → B → C cascades in a single write', () => {
    const calendar = build([
      ev('A', '2024-06-12T09:00', '2024-06-12T10:00'),
      ev('B', '2024-06-12T10:00', '2024-06-12T11:00', [{ id: 'A', type: 'FS' }]),
      ev('C', '2024-06-12T11:00', '2024-06-12T12:00', [{ id: 'B', type: 'FS' }]),
    ])
    // push A +2h → B follows, then C follows B, all in one dispatch
    calendar.updateEvent('A', { start: '2024-06-12T11:00', end: '2024-06-12T12:00' })
    expect(byId(calendar, 'B').start).toBe('2024-06-12T12:00:00')
    expect(byId(calendar, 'B').end).toBe('2024-06-12T13:00:00')
    expect(byId(calendar, 'C').start).toBe('2024-06-12T13:00:00')
    expect(byId(calendar, 'C').end).toBe('2024-06-12T14:00:00')
  })
})
