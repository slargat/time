import { Temporal } from '@js-temporal/polyfill'
import { beforeEach, describe, expect, it } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { eventCrudFeature } from '../event-crud/event-crud-feature'
import { monthViewFeature } from '../month-view/month-view-feature'
import { recurrenceFeature } from './recurrence-feature'
import type { Event } from '../../types'

const june = { currentPeriod: Temporal.PlainDate.from('2024-06-01') }
const daily3 = (): Array<Event> => [
  {
    id: 'r',
    title: 'standup',
    start: '2024-06-10T09:00',
    end: '2024-06-10T09:15',
    recurrence: { frequency: 'daily', count: 3 },
  },
]

const makeCalendar = () =>
  constructCalendar({
    features: { monthViewFeature, recurrenceFeature, eventCrudFeature },
    events: daily3(),
    initialState: june,
  })

const startDates = (calendar: ReturnType<typeof makeCalendar>) =>
  calendar
    .getProjectedEvents()
    .map((e) => (e.start as string).slice(0, 10))
    .sort()

describe('recurrenceFeature scoped editing', () => {
  let calendar: ReturnType<typeof makeCalendar>
  beforeEach(() => {
    calendar = makeCalendar()
    // sanity: three daily occurrences before any edit
    expect(startDates(calendar)).toEqual(['2024-06-10', '2024-06-11', '2024-06-12'])
  })

  it('this: removing one occurrence adds an exDate so it disappears', () => {
    calendar.removeRecurringEvent('r', {
      scope: 'this',
      occurrenceStart: '2024-06-11T09:00',
    })
    expect(startDates(calendar)).toEqual(['2024-06-10', '2024-06-12'])
    // still one stored master, now carrying the exDate
    const stored = calendar.getEvents()
    expect(stored).toHaveLength(1)
    expect(stored[0]!.recurrence!.exDates).toContain('2024-06-11T09:00:00')
  })

  it('this: editing one occurrence adds an override, others unchanged', async () => {
    await calendar.editRecurringEvent(
      'r',
      { title: 'oneoff' },
      { scope: 'this', occurrenceStart: '2024-06-11T09:00' },
    )
    const byDate = Object.fromEntries(
      calendar
        .getProjectedEvents()
        .map((e) => [(e.start as string).slice(0, 10), e.title]),
    )
    expect(byDate).toEqual({
      '2024-06-10': 'standup',
      '2024-06-11': 'oneoff',
      '2024-06-12': 'standup',
    })
  })

  it('all: editing the master title applies to every occurrence', async () => {
    await calendar.editRecurringEvent('r', { title: 'renamed' }, { scope: 'all' })
    const events = calendar.getProjectedEvents()
    expect(events).toHaveLength(3)
    expect(events.every((e) => e.title === 'renamed')).toBe(true)
  })

  it('thisAndFollowing: caps the master and creates a follow-up series', async () => {
    await calendar.editRecurringEvent(
      'r',
      { title: 'split' },
      { scope: 'thisAndFollowing', occurrenceStart: '2024-06-11T09:00' },
    )

    // two stored events now: the capped master + the new split series
    const stored = calendar.getEvents()
    expect(stored).toHaveLength(2)
    const master = stored.find((e) => e.id === 'r')!
    expect(master.recurrence!.until).toBe('2024-06-11')

    // projection: 06-10 from the (capped) master, 06-11 + 06-12 from the split
    const byDate = Object.fromEntries(
      calendar
        .getProjectedEvents()
        .map((e) => [(e.start as string).slice(0, 10), e.title]),
    )
    expect(byDate).toEqual({
      '2024-06-10': 'standup',
      '2024-06-11': 'split',
      '2024-06-12': 'split',
    })
  })
})
