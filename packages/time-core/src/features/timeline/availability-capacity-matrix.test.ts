import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { recurrenceFeature } from '../recurrence/recurrence-feature'
import { availabilityFeature } from './availability-feature'
import type { Event, Resource, ViewMode } from '../../types'

// Availability + capacity behavioral matrix, ported from the OLD @tanstack/time
// suite (packages/time .../calendar.test.ts) and adapted to time-core's
// feature-composed API + corrected semantics:
//   - events canonicalize to SECONDS-precision wall-time on ingestion,
//   - writes require eventCrudFeature (createEvent veto path),
//   - imperative checks go through calendar.validateEventPlacement,
//   - read projection dropping goes through getProjectedEvents.
// 2024-03-18 is a Monday (UTC); 03-19 Tue, 03-23 Sat, 03-24 Sun.
const MON = '2024-03-18'
const TUE = '2024-03-19'
const monday = { currentPeriod: Temporal.PlainDate.from(MON) }
const week = {
  currentPeriod: Temporal.PlainDate.from(MON),
  viewMode: { value: 1, unit: 'week' } as ViewMode,
}
const noEvents: Array<Event> = []

// Mon–Fri 09:00–17:00, capacity 1.
const capRoom: Resource = {
  id: 'r-cap',
  label: 'Capacity Room',
  availability: [{ weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' }],
  capacity: [1],
}

function makeCal(resources: Array<Resource>, events: Array<Event> = noEvents) {
  return constructCalendar({
    features: { monthViewFeature, eventCrudFeature, availabilityFeature },
    events,
    resources,
    initialState: monday,
  })
}

describe('availability + capacity matrix (ported)', () => {
  // --- Availability windows -------------------------------------------------
  describe('placement outside availability windows', () => {
    it('blocks a placement before the window opens (outside-hours)', () => {
      const cal = makeCal([capRoom])
      const r = cal.validateEventPlacement({
        id: 'early',
        title: 'Too early',
        start: `${MON}T07:00:00`,
        end: `${MON}T08:00:00`,
        resources: ['r-cap'],
      })
      expect(r.blocked).toBe(true)
      expect(r.conflict?.resourceDetails[0]?.reason).toBe('outside-hours')
    })

    it('blocks a placement on a weekday the resource is closed (outside-hours)', () => {
      const weekend: Resource = {
        id: 'r-wknd',
        label: 'Weekend Only',
        availability: [{ weekdays: [6, 7], startTime: '09:00', endTime: '17:00' }],
      }
      const cal = makeCal([weekend])
      const r = cal.validateEventPlacement({
        id: 'x',
        title: 'Mon booking',
        start: `${MON}T09:00:00`,
        end: `${MON}T10:00:00`,
        resources: ['r-wknd'],
      })
      expect(r.blocked).toBe(true)
      expect(r.conflict?.resourceDetails[0]?.reason).toBe('outside-hours')
    })

    it('blocks when the event straddles the window edge (07:00–10:00)', () => {
      const cal = makeCal([capRoom])
      expect(
        cal.validateEventPlacement({
          id: 'straddle',
          title: 'Straddle',
          start: `${MON}T07:00:00`,
          end: `${MON}T10:00:00`,
          resources: ['r-cap'],
        }).blocked,
      ).toBe(true)
    })
  })

  describe('resource with no availability configured', () => {
    it('is always unavailable (no-availability)', () => {
      const noAvail: Resource = { id: 'r-none', label: 'Unconfigured' }
      const cal = makeCal([noAvail])
      const r = cal.validateEventPlacement({
        id: 'x',
        title: 'Anytime',
        start: `${MON}T10:00:00`,
        end: `${MON}T11:00:00`,
        resources: ['r-none'],
      })
      expect(r.blocked).toBe(true)
      expect(r.conflict?.resourceDetails[0]?.reason).toBe('no-availability')
    })
  })

  // --- Window boundary edges ------------------------------------------------
  describe('window boundary edges', () => {
    it('accepts an event exactly at the window start', () => {
      const cal = makeCal([capRoom])
      expect(
        cal.validateEventPlacement({
          id: 'open',
          title: 'At open',
          start: `${MON}T09:00:00`,
          end: `${MON}T10:00:00`,
          resources: ['r-cap'],
        }).blocked,
      ).toBe(false)
    })

    it('accepts an event ending exactly at the window end', () => {
      const cal = makeCal([capRoom])
      expect(
        cal.validateEventPlacement({
          id: 'close',
          title: 'At close',
          start: `${MON}T16:00:00`,
          end: `${MON}T17:00:00`,
          resources: ['r-cap'],
        }).blocked,
      ).toBe(false)
    })

    it('accepts an event spanning the full window (09:00–17:00)', () => {
      const cal = makeCal([capRoom])
      expect(
        cal.validateEventPlacement({
          id: 'full',
          title: 'Full day',
          start: `${MON}T09:00:00`,
          end: `${MON}T17:00:00`,
          resources: ['r-cap'],
        }).blocked,
      ).toBe(false)
    })

    it('blocks an event starting exactly at the window end (17:00–18:00)', () => {
      const cal = makeCal([capRoom])
      expect(
        cal.validateEventPlacement({
          id: 'after',
          title: 'At/after close',
          start: `${MON}T17:00:00`,
          end: `${MON}T18:00:00`,
          resources: ['r-cap'],
        }).blocked,
      ).toBe(true)
    })
  })

  // --- Capacity -------------------------------------------------------------
  describe('capacity', () => {
    const withE1 = (): Array<Event> => [
      {
        id: 'e1',
        title: 'E1',
        start: `${MON}T09:00:00`,
        end: `${MON}T10:00:00`,
        resources: ['r-cap'],
        consumption: [1],
      },
    ]

    it('blocks an overlapping placement at max capacity', () => {
      const cal = makeCal([capRoom], withE1())
      expect(
        cal.validateEventPlacement({
          id: 'e2',
          title: 'E2',
          start: `${MON}T09:30:00`,
          end: `${MON}T10:30:00`,
          resources: ['r-cap'],
          consumption: [1],
        }).blocked,
      ).toBe(true)
    })

    it('accepts an adjacent (non-overlapping) placement at capacity', () => {
      const cal = makeCal([capRoom], withE1())
      expect(
        cal.validateEventPlacement({
          id: 'e2',
          title: 'E2',
          start: `${MON}T10:00:00`,
          end: `${MON}T11:00:00`,
          resources: ['r-cap'],
          consumption: [1],
        }).blocked,
      ).toBe(false)
    })

    it('treats missing consumption as 1 (blocks overlap at capacity 1)', () => {
      const cal = makeCal([capRoom], withE1())
      expect(
        cal.validateEventPlacement({
          id: 'e2',
          title: 'E2',
          start: `${MON}T09:30:00`,
          end: `${MON}T10:30:00`,
          resources: ['r-cap'],
        }).blocked,
      ).toBe(true)
    })

    it('blocks when a single event consumption alone exceeds capacity', () => {
      const cal = makeCal([capRoom])
      expect(
        cal.validateEventPlacement({
          id: 'big',
          title: 'Big',
          start: `${MON}T09:00:00`,
          end: `${MON}T10:00:00`,
          resources: ['r-cap'],
          consumption: [5],
        }).blocked,
      ).toBe(true)
    })

    it('accepts when the resource has no capacity configured', () => {
      const noCap: Resource = {
        id: 'r-nocap',
        label: 'No cap',
        availability: [{ weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' }],
      }
      const cal = makeCal([noCap], [
        {
          id: 'e1',
          title: 'E1',
          start: `${MON}T09:00:00`,
          end: `${MON}T10:00:00`,
          resources: ['r-nocap'],
        },
      ])
      expect(
        cal.validateEventPlacement({
          id: 'e2',
          title: 'E2',
          start: `${MON}T09:30:00`,
          end: `${MON}T10:30:00`,
          resources: ['r-nocap'],
        }).blocked,
      ).toBe(false)
    })

    it('sums multi-segment capacity and consumption arrays', () => {
      const multi: Resource = {
        id: 'r-multi',
        label: 'Multi',
        capacity: [1, 2], // sum = 3
        availability: [{ weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' }],
      }
      const cal = makeCal([multi], [
        {
          id: 'e1',
          title: 'E1',
          start: `${MON}T09:00:00`,
          end: `${MON}T10:00:00`,
          resources: ['r-multi'],
          consumption: [1, 1], // uses 2 of 3
        },
      ])
      // 2 + (0+1) = 3 == capacity → allowed.
      expect(
        cal.validateEventPlacement({
          id: 'ok',
          title: 'OK',
          start: `${MON}T09:30:00`,
          end: `${MON}T10:30:00`,
          resources: ['r-multi'],
          consumption: [0, 1],
        }).blocked,
      ).toBe(false)
      // 2 + (1+2) = 5 > 3 → blocked.
      expect(
        cal.validateEventPlacement({
          id: 'no',
          title: 'No',
          start: `${MON}T09:30:00`,
          end: `${MON}T10:30:00`,
          resources: ['r-multi'],
          consumption: [1, 2],
        }).blocked,
      ).toBe(true)
    })

    it('checks capacity per day for a multi-day existing event', () => {
      const cal = makeCal([capRoom], [
        {
          id: 'e1',
          title: 'E1',
          start: `${MON}T09:00:00`,
          end: `${TUE}T10:00:00`,
          resources: ['r-cap'],
          consumption: [1],
        },
      ])
      // Overlaps the existing multi-day event on Tuesday → blocked.
      expect(
        cal.validateEventPlacement({
          id: 'e2',
          title: 'E2',
          start: `${TUE}T09:00:00`,
          end: `${TUE}T10:00:00`,
          resources: ['r-cap'],
          consumption: [1],
        }).blocked,
      ).toBe(true)
    })

    it('capacity [0] short-circuits the capacity check (documents old semantics)', () => {
      // capacitySum <= 0 skips the capacity constraint entirely, so an
      // overlapping placement is NOT blocked. Matches @tanstack/time behavior.
      const zero: Resource = {
        id: 'r-zero',
        label: 'Zero',
        capacity: [0],
        availability: [{ weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' }],
      }
      const cal = makeCal([zero])
      expect(
        cal.validateEventPlacement({
          id: 'x',
          title: 'Anything',
          start: `${MON}T10:00:00`,
          end: `${MON}T11:00:00`,
          resources: ['r-zero'],
          consumption: [1],
        }).blocked,
      ).toBe(false)
    })
  })

  // --- Multi-resource events ------------------------------------------------
  describe('multi-resource events', () => {
    const r1: Resource = {
      id: 'r1',
      label: 'Room 1',
      availability: [{ weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' }],
    }
    const r2Weekend: Resource = {
      id: 'r2',
      label: 'Room 2 (weekend)',
      availability: [{ weekdays: [6, 7], startTime: '09:00', endTime: '17:00' }],
    }

    it('blocks when ANY referenced resource is unavailable', () => {
      const cal = makeCal([r1, r2Weekend])
      const r = cal.validateEventPlacement({
        id: 'x',
        title: 'Both rooms Monday',
        start: `${MON}T10:00:00`,
        end: `${MON}T11:00:00`,
        resources: ['r1', 'r2'],
      })
      expect(r.blocked).toBe(true)
    })

    it('accepts when ALL referenced resources are available', () => {
      const r2Weekday: Resource = {
        id: 'r2',
        label: 'Room 2',
        availability: [{ weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' }],
      }
      const cal = makeCal([r1, r2Weekday])
      expect(
        cal.validateEventPlacement({
          id: 'x',
          title: 'Both rooms Monday',
          start: `${MON}T10:00:00`,
          end: `${MON}T11:00:00`,
          resources: ['r1', 'r2'],
        }).blocked,
      ).toBe(false)
    })
  })

  // --- Write veto path (availabilityValidate) -------------------------------
  describe('availabilityValidate write veto', () => {
    it('rejects a createEvent on unavailable time and leaves the collection untouched', async () => {
      const cal = makeCal([capRoom])
      const result = await cal.createEvent({
        id: 'late',
        title: 'After hours',
        start: `${MON}T18:00`,
        end: `${MON}T19:00`,
        resources: ['r-cap'],
      })
      expect(result.success).toBe(false)
      expect(cal.getEvents()).toHaveLength(0)
    })

    it('rejects a createEvent that would exceed capacity, keeping only the first', async () => {
      const cal = makeCal([capRoom])
      expect(
        await cal.createEvent({
          id: 'a',
          title: 'A',
          start: `${MON}T09:00`,
          end: `${MON}T10:00`,
          resources: ['r-cap'],
        }),
      ).toEqual({ success: true })
      const b = await cal.createEvent({
        id: 'b',
        title: 'B overlap',
        start: `${MON}T09:30`,
        end: `${MON}T10:30`,
        resources: ['r-cap'],
      })
      expect(b.success).toBe(false)
      expect(cal.getEvents().map((e) => e.id)).toEqual(['a'])
      // Canonicalized to seconds-precision wall-time on ingestion.
      expect(cal.getEvents()[0]?.start).toBe(`${MON}T09:00:00`)
    })
  })

  // --- Read filter path (availabilityFilter) --------------------------------
  describe('availabilityFilter read projection', () => {
    it('drops recurring occurrences that land on unavailable days', () => {
      const cal = constructCalendar({
        features: { recurrenceFeature, availabilityFeature },
        events: [
          {
            id: 'r',
            title: 'Daily',
            start: `${MON}T10:00`,
            end: `${MON}T11:00`,
            resources: ['r-cap'],
            recurrence: { frequency: 'daily', count: 7 },
          },
        ],
        resources: [capRoom],
        initialState: week,
      })
      // Mon–Sun expanded (7); Sat/Sun dropped (closed) → Mon–Fri remain.
      expect(cal.getProjectedEvents().map((e) => e.start.slice(0, 10))).toEqual([
        '2024-03-18',
        '2024-03-19',
        '2024-03-20',
        '2024-03-21',
        '2024-03-22',
      ])
    })

    it('drops recurring occurrences that fall outside the daily window (outside-hours)', () => {
      // Occurrence time 18:00 is past the 17:00 close every day → all dropped.
      const cal = constructCalendar({
        features: { recurrenceFeature, availabilityFeature },
        events: [
          {
            id: 'r',
            title: 'Evening daily',
            start: `${MON}T18:00`,
            end: `${MON}T19:00`,
            resources: ['r-cap'],
            recurrence: { frequency: 'daily', count: 7 },
          },
        ],
        resources: [capRoom],
        initialState: week,
      })
      expect(cal.getProjectedEvents()).toHaveLength(0)
    })
  })
})
