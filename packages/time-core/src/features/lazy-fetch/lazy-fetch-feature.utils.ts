import { calendar_getGridDays } from '../../core/calendar/core-calendar-feature.utils'
import { calendar_setEvents } from '../../core/events/core-events-feature.utils'
import type { Calendar_Internal } from '../../types/calendar'
import type { Event } from '../../types'

export interface LoadedRange {
  start: string
  end: string
}

/** Per-calendar lazy-fetch state, held on the instance (the feature is a closure
 * in the original; here it lives on `calendar` so utils can reach it). */
export interface LazyFetchState {
  /** Ranges whose fetch SUCCEEDED (merged/coalesced). */
  loadedRanges: Array<LoadedRange>
  /** Exact ranges with a fetch currently in flight (un-merged, so a failure can
   * remove precisely its own entry — merging `loadedRanges` would strand it). */
  inFlight: Array<LoadedRange>
  unsubscribe?: () => void
}

function state(calendar: Calendar_Internal<any, any, any>): LazyFetchState {
  return calendar._lazyFetch as LazyFetchState
}

export function createLazyFetchState(): LazyFetchState {
  return { loadedRanges: [], inFlight: [] }
}

const covers = (r: LoadedRange, start: string, end: string): boolean =>
  r.start <= start && r.end >= end

/** Already loaded, or an in-flight request already covers this range. */
function isRangeCoveredOrPending(
  calendar: Calendar_Internal<any, any, any>,
  start: string,
  end: string,
): boolean {
  const s = state(calendar)
  return (
    s.loadedRanges.some((r) => covers(r, start, end)) ||
    s.inFlight.some((r) => covers(r, start, end))
  )
}

function addInFlight(
  calendar: Calendar_Internal<any, any, any>,
  start: string,
  end: string,
): void {
  state(calendar).inFlight.push({ start, end })
}

function removeInFlight(
  calendar: Calendar_Internal<any, any, any>,
  start: string,
  end: string,
): void {
  const s = state(calendar)
  s.inFlight = s.inFlight.filter((r) => !(r.start === start && r.end === end))
}

function markRangeLoaded(
  calendar: Calendar_Internal<any, any, any>,
  start: string,
  end: string,
): void {
  const s = state(calendar)
  const ranges = [...s.loadedRanges, { start, end }].sort((a, b) =>
    a.start < b.start ? -1 : 1,
  )
  const merged: Array<LoadedRange> = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) {
      last.end = last.end > r.end ? last.end : r.end
    } else {
      merged.push({ ...r })
    }
  }
  s.loadedRanges = merged
}

function setPending(
  calendar: Calendar_Internal<any, any, any>,
  isPending: boolean,
): void {
  calendar.options.onIsPendingChange?.(isPending)
}

async function runFetch(
  calendar: Calendar_Internal<any, any, any>,
  start: string,
  end: string,
): Promise<void> {
  const fetchEvents = calendar.options.fetchEvents
  if (!fetchEvents) return
  setPending(calendar, true)
  try {
    const fetched = await fetchEvents({ start, end })
    const collection = new Map<string, Event>(
      calendar.getEvents().map((event: Event) => [event.id, event]),
    )
    let hadNew = false
    for (const raw of fetched) {
      if (collection.has(raw.id)) continue
      collection.set(raw.id, raw)
      hadNew = true
    }
    // success: promote the exact in-flight range into the merged loaded set.
    removeInFlight(calendar, start, end)
    markRangeLoaded(calendar, start, end)
    if (hadNew) calendar_setEvents(calendar, [...collection.values()])
    setPending(calendar, false)
  } catch {
    // failure: drop only this exact in-flight range; `loadedRanges` is never
    // touched, so a retry re-fetches (no stranded-by-merge marker).
    removeInFlight(calendar, start, end)
    setPending(calendar, false)
  }
}

export async function calendar_fetchEventsForRange(
  calendar: Calendar_Internal<any, any, any>,
  start: string,
  end: string,
): Promise<void> {
  if (
    !calendar.options.fetchEvents ||
    isRangeCoveredOrPending(calendar, start, end)
  )
    return
  addInFlight(calendar, start, end)
  await runFetch(calendar, start, end)
}

export function calendar_ensureRangeLoaded(
  calendar: Calendar_Internal<any, any, any>,
): void {
  if (!calendar.options.fetchEvents) return
  const days = calendar_getGridDays(calendar)
  if (days.length === 0) return
  const opts = { calendarName: 'never' } as const
  const start = days[0]!.toString(opts)
  const end = days[days.length - 1]!.add({ days: 1 }).toString(opts)
  if (isRangeCoveredOrPending(calendar, start, end)) return
  addInFlight(calendar, start, end)
  void runFetch(calendar, start, end)
}

export function calendar_getLoadedRanges(
  calendar: Calendar_Internal<any, any, any>,
): ReadonlyArray<LoadedRange> {
  return state(calendar).loadedRanges
}

/** Subscribe to navigation so the visible range self-loads on period/view change. */
export function subscribeNavigation(
  calendar: Calendar_Internal<any, any, any>,
): void {
  const navKey = () => {
    const { currentPeriod, viewMode } = calendar.store.state
    return `${currentPeriod.toString({ calendarName: 'never' })}|${viewMode.unit}|${viewMode.value}`
  }
  let prev = navKey()
  const subscription = calendar.store.subscribe(() => {
    const key = navKey()
    if (key === prev) return
    prev = key
    calendar_ensureRangeLoaded(calendar)
  })
  state(calendar).unsubscribe = () => subscription.unsubscribe()
}
