import { coreCalendarFeature } from './calendar/core-calendar-feature'
import { coreDaysFeature } from './days/core-days-feature'
import { coreEventsFeature } from './events/core-events-feature'
import { coreProjectionFeature } from './projection/core-projection-feature'
import { coreViewModelsFeature } from './view-models/core-view-models-feature'
import type { CalendarReactivityBindings } from '../reactivity'
import type { CalendarFeature } from '../types/calendar-features'

/**
 * The built-in core feature set required by every calendar (v9 `coreFeatures`).
 *
 * These provide the store, the Day/Event entities, and the active-view dispatch
 * before optional features are added. `coreReactivityFeature` is supplied by the
 * framework adapter (or the vanilla `storeReactivityBindings`) via the `features`
 * option, so it is typed here but not part of the always-on const.
 */
export interface CoreFeatures {
  coreReactivityFeature?: CalendarReactivityBindings
  coreCalendarFeature: typeof coreCalendarFeature
  coreDaysFeature: typeof coreDaysFeature
  coreEventsFeature: typeof coreEventsFeature
  coreProjectionFeature: typeof coreProjectionFeature
  coreViewModelsFeature: typeof coreViewModelsFeature
}

export const coreFeatures = {
  coreCalendarFeature,
  coreDaysFeature,
  coreEventsFeature,
  coreProjectionFeature,
  coreViewModelsFeature,
} satisfies Record<string, CalendarFeature>
