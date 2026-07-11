import { computeEventProps } from './get-event-props'
import { timeGridView_build } from './time-grid-view-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'
import './time-grid-view-feature.types'

/**
 * Week/day time-grid view, authored as a Feature (decision B). `matches` selects
 * it when the viewMode unit is `week` or `day`; `build` produces the
 * {@link TimeGridViewModel} — Day columns over an hourly axis. It also adds the
 * `event.getEventProps()` node method, whose `style` positions each event by
 * time (and splits overlapping events into columns). All geometry is core-side
 * (framework-agnostic), so the React adapter just renders the numbers.
 */
export const timeGridViewFeature: CalendarFeature = {
  view: {
    matches: (viewMode) =>
      viewMode.unit === 'week' ||
      viewMode.unit === 'day' ||
      viewMode.unit === 'workWeek',
    build: (calendar) => timeGridView_build(calendar),
  },

  assignEventPrototype: (prototype, calendar) => {
    prototype.getEventProps = function (this: { id: string; start: unknown; end: unknown }) {
      return computeEventProps(
        calendar.getProjectedEvents(),
        this as any,
        calendar.store.state.viewMode,
        calendar.options.timeZone ?? 'UTC',
      )
    }
  },
}
