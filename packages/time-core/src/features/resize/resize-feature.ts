import { calendar_dispatchWrite } from '../../pipeline/dispatch-write'
import { calculateResizedEvent } from './get-resize-props'
import { ResizeController } from './resize-controller'
import type { ResizeEdge } from './get-resize-props'
import type { ResizeHost } from './resize-controller'
import type { CalendarFeature } from '../../types/calendar-features'
import type {
  ResizeHandleOptions,
  ResizePointerEvent,
} from './resize-feature.types'
import './resize-feature.types'

/**
 * Drag-to-resize (opt-in). Wires a {@link ResizeController} to the calendar via a
 * {@link ResizeHost} adapter and adds node methods `event.getResizeHandleProps`
 * + `day.getColumnProps`. Commits route through `dispatchWrite`, so a resize
 * runs the full write pipeline (dependency cascade, availability veto) — no
 * `_internal` casts.
 *
 * ponytail: `validateResize` only snaps/min-duration here; availability blocking
 * during the drag and scoped recurring resizes are follow-ups (the latter falls
 * back to a single edit).
 */
export const resizeFeature: CalendarFeature = {
  constructCalendarApis: (calendar) => {
    const commitUpdate = (id: string, updates: Record<string, unknown>) => {
      const existing = calendar.getEvents().find((e: any) => e.id === id)
      if (!existing) return
      calendar_dispatchWrite(calendar, [
        { kind: 'update', event: { ...existing, ...updates, id } },
      ])
    }

    const host: ResizeHost<any, any> = {
      getEvents: () => calendar.getEvents(),
      getDaysWithEvents: () => calendar.getProjectedDays(),
      validateResize: (options) => ({
        blocked: false,
        result: calculateResizedEvent({
          originalStart: options.originalStart,
          originalEnd: options.originalEnd,
          edge: options.edge,
          deltaMinutes: options.totalDeltaMinutes,
          // read live so a runtime `setOptions({ timeZone })` takes effect.
          timeZone: calendar.options.timeZone ?? 'UTC',
          constraints: options.constraints,
        }),
        targetDayDate: options.targetDayDate,
      }),
      commitUpdate,
      editRecurringEvent: (eventId, updates) => {
        // ponytail: scoped recurring resize is deferred — fall back to a single
        // edit (the same fallback the original used when recurrence was absent).
        commitUpdate(eventId, updates as Record<string, unknown>)
        return Promise.resolve({ success: true })
      },
    }

    const controller = new ResizeController(host, calendar.options.resize ?? {})
    calendar.resizeController = controller
    calendar.getResizeState = () => controller.getSnapshot()
  },

  assignEventPrototype: (prototype, calendar) => {
    prototype.getResizeHandleProps = function (
      this: {
        id: string
        start: unknown
        end: unknown
        _originalStart?: string
        _originalEnd?: string
      },
      edge: ResizeEdge,
      options?: ResizeHandleOptions,
    ) {
      const id = this.id
      // Multi-day segments carry the full span on `_original*`.
      const originalStart = (this._originalStart ?? this.start) as string
      const originalEnd = (this._originalEnd ?? this.end) as string
      return {
        onMouseDown: (event: ResizePointerEvent) => {
          const started = calendar.resizeController.start({
            eventId: id,
            edge,
            originalStart,
            originalEnd,
            occurrenceStart: options?.occurrenceStart,
            recurrenceScope: options?.recurrenceScope,
            clientX: event.clientX,
            clientY: event.clientY,
            target: event.target as HTMLElement | null,
          })
          if (!started) return
          event.preventDefault()
          event.stopPropagation()
        },
      }
    }
  },

  assignDayPrototype: (prototype, calendar) => {
    prototype.getColumnProps = function (this: { isoDate: string }) {
      const isoDate = this.isoDate
      return {
        ref: (element: HTMLElement | null) =>
          calendar.resizeController.registerDayColumn(isoDate, element),
      }
    }
  },

  destroy: (calendar) => {
    calendar.resizeController?.destroy()
  },
}
