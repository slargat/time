import { Temporal } from '@js-temporal/polyfill'
import type {
  AvailabilityConflict,
  Event,
  Resource,
  UnavailableRange,
} from './types'
import { toPlainDateTimeString } from '~/date/parse'

/**
 * Resource availability + capacity logic, extracted from `CalendarCore` so the
 * class and the feature-composed instance share one implementation. All state
 * (resources + memo caches + the live event set) is passed in via
 * {@link AvailabilityContext}.
 */

export const MINUTES_IN_DAY = 24 * 60

export interface MinuteRange {
  startMinutes: number
  endMinutes: number
}

export interface ResourceDayAvail {
  available: Array<MinuteRange>
  unavailable: Array<MinuteRange>
  hasAvailability: boolean
  slotsForWeekday: Array<MinuteRange>
}

export interface UnavailabilityDetail {
  resourceId: string
  resourceLabel: string
  reason: 'outside-hours' | 'capacity' | 'no-availability'
  description: string
}

export interface AvailabilityContext<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  resources: Array<TResource> | null
  /** Live events to consider for capacity overlap. */
  events: Iterable<TEvent>
  resourceDayAvailCache: Map<string, ResourceDayAvail>
  mergedUnavailMinuteCache: Map<string, Array<MinuteRange>>
  weekdayCache: Map<string, number>
}

export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function getWeekday(date: string, cache: Map<string, number>): number {
  const cached = cache.get(date)
  if (cached !== undefined) return cached
  const y = +date.slice(0, 4)
  const m = +date.slice(5, 7)
  const d = +date.slice(8, 10)
  const jsDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const iso = jsDow === 0 ? 7 : jsDow
  cache.set(date, iso)
  return iso
}

export function parseHmToMinutes(hm: string): number {
  const h = (hm.charCodeAt(0) - 48) * 10 + (hm.charCodeAt(1) - 48)
  const mi = (hm.charCodeAt(3) - 48) * 10 + (hm.charCodeAt(4) - 48)
  return h * 60 + mi
}

export function resolveEventResources<TResource extends Resource>(
  event: { resources?: Array<TResource | string> },
  resources: Array<TResource> | null,
): Array<TResource> {
  return (event.resources ?? []).map((r) => {
    if (typeof r === 'string') {
      return (
        resources?.find((res) => res.id === r) ??
        ({ id: r, label: r } as TResource)
      )
    }
    return r
  })
}

export function getEventResourceIds<TResource extends Resource>(event: {
  resources?: Array<TResource | string>
}): Array<string> {
  return (event.resources ?? []).map((r) => (typeof r === 'string' ? r : r.id))
}

export function getResourceDayAvail<TResource extends Resource>(
  resource: TResource,
  weekday: number,
  cache: Map<string, ResourceDayAvail>,
): ResourceDayAvail {
  const key = `${resource.id}:${weekday}`
  const cached = cache.get(key)
  if (cached) return cached

  const slotsForWeekday: Array<MinuteRange> = []
  if (resource.availability) {
    for (const slot of resource.availability) {
      if (!slot.weekdays.includes(weekday)) continue
      slotsForWeekday.push({
        startMinutes: parseHmToMinutes(slot.startTime),
        endMinutes: parseHmToMinutes(slot.endTime),
      })
    }
  }

  slotsForWeekday.sort((a, b) => a.startMinutes - b.startMinutes)
  const available: Array<MinuteRange> = []
  for (const r of slotsForWeekday) {
    const last = available[available.length - 1]
    if (last && r.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, r.endMinutes)
    } else {
      available.push({ ...r })
    }
  }

  const unavailable: Array<MinuteRange> = []
  let cursor = 0
  for (const a of available) {
    if (cursor < a.startMinutes) {
      unavailable.push({ startMinutes: cursor, endMinutes: a.startMinutes })
    }
    cursor = a.endMinutes
  }
  if (cursor < MINUTES_IN_DAY) {
    unavailable.push({ startMinutes: cursor, endMinutes: MINUTES_IN_DAY })
  }

  const result: ResourceDayAvail = {
    available,
    unavailable,
    hasAvailability: !!resource.availability,
    slotsForWeekday,
  }
  cache.set(key, result)
  return result
}

export function getMergedUnavailableMinuteRanges<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  date: string,
  resourceIds: Array<TResource['id']> | undefined,
  ctx: AvailabilityContext<TResource, TEvent>,
): Array<MinuteRange> | null {
  const allResources = ctx.resources
  if (!allResources || allResources.length === 0) return null

  const resources = resourceIds
    ? allResources.filter((r) => resourceIds.includes(r.id))
    : allResources
  if (resources.length === 0) return null

  const sortedIds = resources
    .map((r) => r.id)
    .slice()
    .sort()
    .join(',')
  const cacheKey = `${sortedIds}|${date}`
  const cached = ctx.mergedUnavailMinuteCache.get(cacheKey)
  if (cached) return cached

  const weekday = getWeekday(date, ctx.weekdayCache)

  const availableRanges: Array<MinuteRange> = []
  for (const resource of resources) {
    if (!resource.availability) continue
    const info = getResourceDayAvail(resource, weekday, ctx.resourceDayAvailCache)
    for (const a of info.available) availableRanges.push(a)
  }

  if (availableRanges.length === 0) {
    const fullDay = [{ startMinutes: 0, endMinutes: MINUTES_IN_DAY }]
    ctx.mergedUnavailMinuteCache.set(cacheKey, fullDay)
    return fullDay
  }

  availableRanges.sort((a, b) => a.startMinutes - b.startMinutes)
  const mergedAvail: Array<MinuteRange> = []
  for (const range of availableRanges) {
    const last = mergedAvail[mergedAvail.length - 1]
    if (last && range.startMinutes <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, range.endMinutes)
    } else {
      mergedAvail.push({ ...range })
    }
  }

  const unavailable: Array<MinuteRange> = []
  let cursor = 0
  for (const a of mergedAvail) {
    if (cursor < a.startMinutes) {
      unavailable.push({ startMinutes: cursor, endMinutes: a.startMinutes })
    }
    cursor = a.endMinutes
  }
  if (cursor < MINUTES_IN_DAY) {
    unavailable.push({ startMinutes: cursor, endMinutes: MINUTES_IN_DAY })
  }

  ctx.mergedUnavailMinuteCache.set(cacheKey, unavailable)
  return unavailable
}

export function getUnavailableRangesPx<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  date: string,
  options: { containerHeight?: number; resourceIds?: Array<TResource['id']> } | undefined,
  ctx: AvailabilityContext<TResource, TEvent>,
): Array<UnavailableRange> {
  const containerHeight = options?.containerHeight ?? 1440
  const merged = getMergedUnavailableMinuteRanges(
    date,
    options?.resourceIds,
    ctx,
  )
  if (merged === null) return []

  const scale = containerHeight / MINUTES_IN_DAY
  return merged.map((range) => ({
    top: range.startMinutes * scale,
    height: (range.endMinutes - range.startMinutes) * scale,
    startTime: formatMinutesToTime(range.startMinutes),
    endTime: formatMinutesToTime(range.endMinutes),
  }))
}

export function getUnavailabilityDetails<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  date: string,
  startMinutes: number,
  endMinutes: number,
  resourceIds: Array<TResource['id']> | undefined,
  ctx: AvailabilityContext<TResource, TEvent>,
): Array<UnavailabilityDetail> {
  const resources = resourceIds
    ? ctx.resources?.filter((resource) => resourceIds.includes(resource.id))
    : ctx.resources

  if (!resources || resources.length === 0) return []

  const weekday = getWeekday(date, ctx.weekdayCache)
  const details: Array<UnavailabilityDetail> = []

  for (const resource of resources) {
    if (!resource.availability || resource.availability.length === 0) {
      details.push({
        resourceId: resource.id,
        resourceLabel: resource.label,
        reason: 'no-availability',
        description: `${resource.label}: No availability configured`,
      })
      continue
    }

    const info = getResourceDayAvail(resource, weekday, ctx.resourceDayAvailCache)
    const availableSlots = info.slotsForWeekday

    if (availableSlots.length === 0) {
      details.push({
        resourceId: resource.id,
        resourceLabel: resource.label,
        reason: 'outside-hours',
        description: `${resource.label}: Not available on this day`,
      })
      continue
    }

    let isWithinAvailability = false
    for (const slot of availableSlots) {
      if (startMinutes >= slot.startMinutes && endMinutes <= slot.endMinutes) {
        isWithinAvailability = true
        break
      }
    }

    if (!isWithinAvailability) {
      let availabilityWindow = ''
      for (let i = 0; i < availableSlots.length; i++) {
        const r = availableSlots[i]!
        if (i > 0) availabilityWindow += ', '
        availabilityWindow += `${formatMinutesToTime(r.startMinutes)}-${formatMinutesToTime(r.endMinutes)}`
      }

      details.push({
        resourceId: resource.id,
        resourceLabel: resource.label,
        reason: 'outside-hours',
        description: `${resource.label}: Available ${availabilityWindow}, but event is ${formatMinutesToTime(startMinutes)}-${formatMinutesToTime(endMinutes)}`,
      })
    }
  }

  return details
}

export function checkEventAvailability<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  event: TEvent,
  newStart: string,
  newEnd: string,
  ctx: AvailabilityContext<TResource, TEvent>,
  newResources?: Array<TResource | string>,
  newConsumption?: Array<number>,
): AvailabilityConflict | null {
  const resources =
    newResources?.map((r) =>
      typeof r === 'string'
        ? (ctx.resources?.find((res) => res.id === r) ??
          ({ id: r, label: r } as TResource))
        : r,
    ) || resolveEventResources(event, ctx.resources)
  if (!resources.length) return null

  const resourceIds = resources.map((r) => r.id)
  const startDt = Temporal.PlainDateTime.from(newStart)
  const endDt = Temporal.PlainDateTime.from(newEnd)

  const startDate = startDt.toPlainDate()
  const endDate = endDt.toPlainDate()
  let cursorDate = startDate

  const eventConsumptionArr = newConsumption ?? event.consumption ?? [1]
  const eventConsumptionSum = eventConsumptionArr.reduce((a, b) => a + b, 0)

  while (Temporal.PlainDate.compare(cursorDate, endDate) <= 0) {
    const dayStr = cursorDate.toString({ calendarName: 'never' })
    const isSameAsStart = Temporal.PlainDate.compare(cursorDate, startDate) === 0
    const isSameAsEnd = Temporal.PlainDate.compare(cursorDate, endDate) === 0

    const overlapStartMins = isSameAsStart ? startDt.hour * 60 + startDt.minute : 0
    let overlapEndMins: number
    if (isSameAsEnd) {
      const endMins = endDt.hour * 60 + endDt.minute
      overlapEndMins =
        endMins === 0 && !isSameAsStart ? 0 : endMins || MINUTES_IN_DAY
    } else {
      overlapEndMins = MINUTES_IN_DAY
    }

    if (overlapStartMins < overlapEndMins) {
      const details = getUnavailabilityDetails(
        dayStr,
        overlapStartMins,
        overlapEndMins,
        resourceIds,
        ctx,
      )

      if (details.length > 0) {
        return {
          date: dayStr,
          conflictRange: {
            start: formatMinutesToTime(overlapStartMins),
            end: formatMinutesToTime(overlapEndMins),
          },
          resourceIds,
          resourceDetails: details.map((d) => ({
            resourceId: d.resourceId,
            resourceLabel: d.resourceLabel,
            reason: d.reason,
            description: `"${event.title}": ${d.description}`,
          })),
          description: `"${event.title}" would be pushed to unavailable time: ${details.map((d) => d.description).join('; ')}`,
        }
      }

      const eventsOnDay: Array<TEvent> = []
      for (const candidate of ctx.events) {
        if (candidate._originalStart) continue
        const cStart = Temporal.PlainDateTime.from(
          toPlainDateTimeString(candidate.start),
        ).toPlainDate()
        const cEnd = Temporal.PlainDateTime.from(
          toPlainDateTimeString(candidate.end),
        ).toPlainDate()
        if (
          Temporal.PlainDate.compare(cursorDate, cStart) >= 0 &&
          Temporal.PlainDate.compare(cursorDate, cEnd) <= 0
        ) {
          eventsOnDay.push(candidate)
        }
      }
      for (const resource of resources) {
        if (!resource.capacity || resource.capacity.length === 0) continue
        const capacitySum = resource.capacity.reduce((a, b) => a + b, 0)
        if (capacitySum <= 0) continue

        const overlappingEvents = eventsOnDay.filter((e) => {
          const masterId = e._recurringMasterId ?? e.id
          const selfId = event.id
          if (e.id === selfId || masterId === selfId) return false

          const eventResourceIds = getEventResourceIds(e)
          if (!eventResourceIds.includes(resource.id)) return false

          const eOrigStart = (e._originalStart ?? e.start) as
            | string
            | Date
            | number
          const eOrigEnd = (e._originalEnd ?? e.end) as string | Date | number
          const eStartDt = Temporal.PlainDateTime.from(
            toPlainDateTimeString(eOrigStart),
          )
          const eEndDt = Temporal.PlainDateTime.from(
            toPlainDateTimeString(eOrigEnd),
          )

          const eStartDate = eStartDt.toPlainDate()
          const eEndDate = eEndDt.toPlainDate()
          const cursorIsStart =
            Temporal.PlainDate.compare(cursorDate, eStartDate) === 0
          const cursorIsEnd =
            Temporal.PlainDate.compare(cursorDate, eEndDate) === 0
          const cursorAfterStart =
            Temporal.PlainDate.compare(cursorDate, eStartDate) >= 0
          const cursorBeforeEnd =
            Temporal.PlainDate.compare(cursorDate, eEndDate) <= 0
          if (!cursorAfterStart || !cursorBeforeEnd) return false

          const eStartMins = cursorIsStart ? eStartDt.hour * 60 + eStartDt.minute : 0
          let eEndMins: number
          if (cursorIsEnd) {
            const m = eEndDt.hour * 60 + eEndDt.minute
            eEndMins = m === 0 && !cursorIsStart ? 0 : m || MINUTES_IN_DAY
          } else {
            eEndMins = MINUTES_IN_DAY
          }

          return overlapStartMins < eEndMins && overlapEndMins > eStartMins
        })

        const seen = new Set<string>()
        let usedByOthers = 0
        for (const oe of overlappingEvents) {
          const key = oe.id
          if (seen.has(key)) continue
          seen.add(key)
          const c = oe.consumption ?? [1]
          usedByOthers += c.reduce((a, b) => a + b, 0)
        }

        const totalUsage = usedByOthers + eventConsumptionSum
        if (totalUsage > capacitySum) {
          return {
            date: dayStr,
            conflictRange: {
              start: formatMinutesToTime(overlapStartMins),
              end: formatMinutesToTime(overlapEndMins),
            },
            resourceIds: [resource.id],
            resourceDetails: [
              {
                resourceId: resource.id,
                resourceLabel: resource.label,
                reason: 'capacity',
                description: `"${event.title}": ${resource.label} capacity exceeded (${totalUsage}/${capacitySum} units used)`,
                capacityInfo: {
                  max: capacitySum,
                  used: totalUsage,
                  remaining: Math.max(0, capacitySum - usedByOthers),
                },
              },
            ],
            description: `"${event.title}" exceeds ${resource.label} capacity (${totalUsage}/${capacitySum})`,
          }
        }
      }
    }

    cursorDate = cursorDate.add({ days: 1 })
  }

  return null
}
