import { Temporal } from '@js-temporal/polyfill'
import { describe, expect, it, vi } from 'vitest'
import { constructCalendar } from '../../core/calendar/construct-calendar'
import { monthViewFeature } from '../month-view/month-view-feature'
import { lazyFetchFeature } from './lazy-fetch-feature'
import type { Event } from '../../types'

const june = { currentPeriod: Temporal.PlainDate.from('2024-06-01') }
const fetched: Array<Event> = [
  { id: 'f1', title: 'Fetched', start: '2024-06-12T09:00', end: '2024-06-12T10:00' },
]

describe('lazyFetchFeature', () => {
  it('fetches a range, merges events, and toggles isPending', async () => {
    const fetchEvents = vi.fn(() => Promise.resolve(fetched))
    const calendar = constructCalendar({
      features: { monthViewFeature, lazyFetchFeature },
      events: [] as Array<Event>,
      initialState: june,
      fetchEvents,
    })

    expect(calendar.getEvents()).toEqual([])

    await calendar.fetchEventsForRange('2024-06-01', '2024-06-30')

    expect(fetchEvents).toHaveBeenCalledTimes(1)
    expect(calendar.store.state.isPending).toBe(false)
    expect(calendar.getEvents().map((e) => e.id)).toEqual(['f1'])
    expect(calendar.getLoadedRanges()).toEqual([
      { start: '2024-06-01', end: '2024-06-30' },
    ])
  })

  it('does not re-fetch a range already loaded', async () => {
    const fetchEvents = vi.fn(() => Promise.resolve(fetched))
    const calendar = constructCalendar({
      features: { monthViewFeature, lazyFetchFeature },
      events: [] as Array<Event>,
      initialState: june,
      fetchEvents,
    })

    await calendar.fetchEventsForRange('2024-06-01', '2024-06-30')
    await calendar.fetchEventsForRange('2024-06-10', '2024-06-20') // inside loaded
    expect(fetchEvents).toHaveBeenCalledTimes(1)
  })

  it('a failed fetch is not marked loaded and retries — even after an adjacent range merged', async () => {
    // First range succeeds and is marked loaded. The second, adjacent range
    // fails: under the old optimistic-merge design it would have merged into the
    // first before failing, so the exact-match rollback found nothing and it
    // stayed "loaded" forever. It must remain retryable.
    let call = 0
    const fetchEvents = vi.fn(({ start }: { start: string; end: string }) => {
      call++
      return start === '2024-07-01'
        ? Promise.reject(new Error('network'))
        : Promise.resolve(fetched)
    })
    const calendar = constructCalendar({
      features: { monthViewFeature, lazyFetchFeature },
      events: [] as Array<Event>,
      initialState: june,
      fetchEvents,
    })

    await calendar.fetchEventsForRange('2024-06-01', '2024-07-01') // ok
    await calendar.fetchEventsForRange('2024-07-01', '2024-08-01') // fails (adjacent)

    // the failed range is NOT loaded, and the isPending flag settled back.
    expect(calendar.getLoadedRanges()).toEqual([
      { start: '2024-06-01', end: '2024-07-01' },
    ])
    expect(calendar.store.state.isPending).toBe(false)

    // retry the failed range — it must actually re-fetch (not skipped as loaded).
    await calendar.fetchEventsForRange('2024-07-01', '2024-08-01')
    expect(fetchEvents).toHaveBeenCalledTimes(3)
  })

  it('is a no-op without a fetchEvents option', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature, lazyFetchFeature },
      events: [] as Array<Event>,
      initialState: june,
    })
    calendar.ensureRangeLoaded()
    expect(calendar.getLoadedRanges()).toEqual([])
    expect(calendar.store.state.isPending).toBe(false)
  })
})
