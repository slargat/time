import type { Event, Resource } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'

/**
 * Undo/redo over event mutations. Snapshots/restores via the public
 * `getEvents()`/`setEvents()` from `eventsFeature` (which it requires).
 *
 * Mutating features (crud, resize, recurrence) record a checkpoint by calling
 * `calendar._pushHistory()` before they commit. Until those land, the undo
 * stack only fills when a caller checkpoints explicitly.
 */
export const historyFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const undoStack: Array<Array<TEvent>> = []
    const redoStack: Array<Array<TEvent>> = []

    calendar.undo = () => {
      const restored = undoStack.pop()
      if (!restored) return
      redoStack.push(calendar.getEvents())
      calendar.setEvents(restored)
    }

    calendar.redo = () => {
      const restored = redoStack.pop()
      if (!restored) return
      undoStack.push(calendar.getEvents())
      calendar.setEvents(restored)
    }

    calendar.canUndo = () => undoStack.length > 0
    calendar.canRedo = () => redoStack.length > 0

    // Checkpoint hook for mutating features — snapshot current events, clear redo.
    ;(calendar as { _pushHistory?: () => void })._pushHistory = () => {
      undoStack.push(calendar.getEvents())
      redoStack.length = 0
    }
  },
}
