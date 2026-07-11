import { monthView_build } from './month-view-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'

/**
 * Month view, authored as a Feature (decision B): it carries a `view` descriptor.
 * `matches` selects it as active when the viewMode unit is `month`; `build`
 * produces the {@link MonthViewModel}. Importing it registers the view and adds
 * its model to the `getView()` union (see `month-view-feature.types.ts`).
 */
export const monthViewFeature: CalendarFeature = {
  view: {
    matches: (viewMode) => viewMode.unit === 'month',
    build: (calendar) => monthView_build(calendar),
  },
}
