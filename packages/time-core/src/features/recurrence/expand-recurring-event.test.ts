import { describe, expect, it } from 'vitest'
import { expandRecurringEvent } from './expand-recurring-event'
import type { Event } from '../../types'

const master = (recurrence: Event['recurrence']): Event => ({
  id: 'r',
  title: 'Recurring',
  start: '2024-01-01T09:00:00',
  end: '2024-01-01T10:00:00',
  recurrence,
})

const starts = (occ: Array<Event>) =>
  occ.map((e) => (e.start as string).slice(0, 10))

describe('expandRecurringEvent window edges', () => {
  it('includes an occurrence that falls exactly on `until` (RFC 5545 inclusive)', () => {
    const occ = expandRecurringEvent(
      master({ frequency: 'daily', until: '2024-01-05' }),
      '2024-01-01',
      '2024-02-01',
    )
    // 01-05 is exactly `until` and must be emitted; 01-06 must not.
    expect(starts(occ)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ])
  })

  it('emits an occurrence whose override pulls its start back into the window from beyond windowEnd', () => {
    // Weekly Mondays from 03-25. Window [03-01, 04-01). The 04-08 occurrence sits
    // beyond windowEnd, but its override moves start to 03-31 (in-window). The old
    // termination-at-windowEnd dropped it before the loop ever reached 04-08.
    const event: Event = {
      id: 'r',
      title: 'Weekly',
      start: '2024-03-25T09:00:00',
      end: '2024-03-25T10:00:00',
      recurrence: {
        frequency: 'weekly',
        overrides: [
          {
            originalStart: '2024-04-08T09:00:00',
            start: '2024-03-31T09:00:00',
            end: '2024-03-31T10:00:00',
          },
        ],
      },
    }
    const occ = expandRecurringEvent(event, '2024-03-01', '2024-04-01')
    expect(starts(occ)).toEqual(['2024-03-25', '2024-03-31'])
  })

  it('expands a series starting years before the window without MAX_STEPS truncation', () => {
    // Daily from 2010 viewed in 2035 is >9000 days out — stepping from 0 would burn
    // MAX_STEPS (3650) and silently return nothing. The seek must land in-window.
    const event: Event = {
      id: 'r',
      title: 'Old daily',
      start: '2010-01-01T09:00:00',
      end: '2010-01-01T10:00:00',
      recurrence: { frequency: 'daily' },
    }
    const occ = expandRecurringEvent(event, '2035-06-01', '2035-06-04')
    expect(starts(occ)).toEqual(['2035-06-01', '2035-06-02', '2035-06-03'])
  })
})
