import { Temporal } from '@js-temporal/polyfill'
import { assignCalendarAPIs, makeCalendarStateUpdater } from '../../utils'
import {
  calendar_changeViewMode,
  calendar_clipToWindow,
  calendar_goToCurrentPeriod,
  calendar_goToNextPeriod,
  calendar_goToPreviousPeriod,
  calendar_goToSpecificPeriod,
} from './core-calendar-feature.utils'
import type { CalendarFeature } from '../../types/calendar-features'
import type { ViewMode } from '../../types'

/**
 * The always-on calendar singleton feature: seeds default store state and
 * installs viewport navigation APIs. Runs first (it leads `coreFeatures`).
 */
export const coreCalendarFeature: CalendarFeature = {
  getInitialState: (state) => ({
    currentPeriod: Temporal.Now.plainDateISO(),
    activeDate: Temporal.Now.plainDateISO(),
    viewMode: { value: 1, unit: 'month' } as ViewMode,
    isPending: false,
    ...state,
  }),

  // Default `on<Slice>Change` handlers write through the owning atom. A consumer
  // controlling a slice supplies its own handler (paired with `state[slice]`).
  getDefaultOptions: (calendar) => ({
    onCurrentPeriodChange: makeCalendarStateUpdater('currentPeriod', calendar),
    onActiveDateChange: makeCalendarStateUpdater('activeDate', calendar),
    onViewModeChange: makeCalendarStateUpdater('viewMode', calendar),
    onIsPendingChange: makeCalendarStateUpdater('isPending', calendar),
  }),

  constructCalendarApis: (calendar) => {
    assignCalendarAPIs('coreCalendarFeature', calendar, {
      calendar_changeViewMode: {
        fn: (viewMode: ViewMode) => calendar_changeViewMode(calendar, viewMode),
      },
      calendar_goToNextPeriod: {
        fn: () => calendar_goToNextPeriod(calendar),
      },
      calendar_goToPreviousPeriod: {
        fn: () => calendar_goToPreviousPeriod(calendar),
      },
      calendar_goToCurrentPeriod: {
        fn: () => calendar_goToCurrentPeriod(calendar),
      },
      calendar_goToSpecificPeriod: {
        fn: (date) => calendar_goToSpecificPeriod(calendar, date),
      },
    })
  },

  // The kernel-fixed `clip` stage of the read projection (ADR 0001/0007).
  projection: {
    clip: calendar_clipToWindow,
  },
}
