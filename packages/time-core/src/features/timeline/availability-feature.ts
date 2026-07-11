import { assignCalendarAPIs } from '../../utils'
import {
  availability_filter,
  availability_validate,
  calendar_validateEventPlacement,
  createAvailabilityCaches,
} from './availability-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'
import './availability-feature.types'

/**
 * Resource availability + capacity (opt-in). Fills two kernel-ordered stages and
 * exposes an imperative check:
 * - `availabilityFilter` (read): drop recurring occurrences on unavailable time.
 * - `availabilityValidate` (write): veto a placement that violates availability.
 * - `validateEventPlacement`: imperative check (UI / dependency validation).
 *
 * No-op when `options.resources` is empty.
 */
export const availabilityFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    calendar._availability = createAvailabilityCaches()
    // `setOptions` calls this when `options.resources` changes; the caches are
    // keyed by resource×weekday and would otherwise serve stale entries.
    calendar._resetAvailabilityCaches = () => {
      calendar._availability = createAvailabilityCaches()
    }
    assignCalendarAPIs('availabilityFeature', calendar, {
      calendar_validateEventPlacement: {
        fn: (input) => calendar_validateEventPlacement(calendar, input),
      },
    })
  },
  projection: { availabilityFilter: availability_filter },
  write: { availabilityValidate: availability_validate },
}
