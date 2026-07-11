import type { Calendar_Internal } from '../../types/calendar'

/**
 * Active-view dispatch (the v9 `table_getRowModel` analogue): find the one
 * registered View whose `matches(viewMode)` passes and run its `build`. Only the
 * active view is computed.
 */
export function calendar_getView(
  calendar: Calendar_Internal<any, any, any>,
): unknown {
  const viewMode = calendar.store.state.viewMode
  const view = calendar._views.find((v) => v.matches(viewMode))
  if (!view) {
    throw new Error(
      `[time-core] no registered View matches viewMode "${viewMode.unit}". Register a View feature (e.g. monthViewFeature).`,
    )
  }
  return view.build(calendar)
}
