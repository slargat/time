import type { UnavailabilityDetail } from '../availability'
import type { Event, Resource, UnavailableRange } from '../types'

/**
 * API contributed by `timelineFeature` — resources + availability. Also gates
 * recurring-occurrence placement (eventsFeature) on resource availability.
 *
 * ponytail: `getTimelineLayout` and `validateMove` are the remaining timeline
 * methods — added in a follow-up; they are pure additive view/validation.
 */
export interface Calendar_Timeline<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  /** Replace the resource set (clears availability caches). */
  setResources: (resources: Array<TResource> | null) => void
  /** Unavailable pixel ranges for a date (for rendering shaded zones). */
  getUnavailableRanges: (
    date: string,
    options?: {
      containerHeight?: number
      resourceIds?: Array<TResource['id']>
    },
  ) => Array<UnavailableRange>
  /** Why a [start,end] minute window is unavailable for the given resources. */
  getUnavailabilityDetails: (
    date: string,
    startMinutes: number,
    endMinutes: number,
    options?: { resourceIds?: Array<TResource['id']> },
  ) => Array<UnavailabilityDetail>
  /** Whether a candidate event can be placed without violating availability. */
  validateEventPlacement: (event: {
    id?: string
    title: string
    start: string
    end: string
    resources?: Array<TResource | string>
    consumption?: Array<number>
  }) => { blocked: boolean; message?: string }
  /** Visible events grouped by resource id (multi-day segments merged). */
  getEventsByResource: () => Map<TResource['id'], Array<TEvent>>
}
