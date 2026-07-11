import { timelineView_build } from './timeline-view-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'

/**
 * Timeline view, authored as a Feature (decision B): it carries a `view`
 * descriptor. `matches` selects it when the viewMode unit is `timeline`; `build`
 * produces the {@link TimelineViewModel} — resources as lanes over a time axis.
 * Importing it registers the view and adds its model to the `getView()` union
 * (see `timeline-view-feature.types.ts`).
 */
export const timelineViewFeature: CalendarFeature = {
  view: {
    matches: (viewMode) => viewMode.unit === 'timeline',
    build: (calendar) => timelineView_build(calendar),
  },
}
