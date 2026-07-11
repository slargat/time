import { constructEvent } from '../../core/events/construct-event'
import { getTimeSlots } from './get-time-slots'
import type { Calendar_Internal } from '../../types/calendar'
import type { TimelineViewModel } from './timeline-view-feature.types'

/**
 * Build the timeline view model: a time axis plus one lane per resource, each
 * lane holding the events that reference that resource (by id).
 *
 * Reads the projected occurrences (`source → recurrence-expand → clip →
 * availability-filter`), so recurring events are expanded, clipped to the
 * viewport, and availability-filtered before lane grouping.
 */
export function timelineView_build(
  calendar: Calendar_Internal<any, any, any>,
): TimelineViewModel<any, any, any> {
  const resources = calendar.options.resources ?? []
  const locale = calendar.options.locale ?? 'en-US'
  const events = calendar.getProjectedEvents()

  // resource id -> its events (preserves resource order; unknown ids ignored)
  const byResource = new Map<string, Array<any>>(
    resources.map((r: any): [string, Array<any>] => [r.id, []]),
  )
  for (const event of events) {
    // Wrap in the event prototype so lane events are real nodes (node methods
    // like getResizeHandleProps work), same as calendar_getProjectedDays. The
    // timeline keeps whole events — no per-day splitting on a horizontal axis.
    const node = constructEvent(calendar, event)
    for (const ref of event.resources ?? []) {
      const id = typeof ref === 'string' ? ref : ref.id
      byResource.get(id)?.push(node)
    }
  }

  return {
    view: 'timeline',
    timeSlots: getTimeSlots(locale),
    lanes: resources.map((resource: any) => ({
      resource,
      events: byResource.get(resource.id) ?? [],
    })),
    // EventNode<any,…> collapses to `never` at this all-any boundary; concrete
    // call sites resolve it correctly (same boundary as Calendar_Internal<any>).
  } as TimelineViewModel<any, any, any>
}
