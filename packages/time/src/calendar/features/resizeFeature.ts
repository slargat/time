import { calculateResizedEvent } from '../getResizeProps'
import { ResizeController } from '../resizeController'
import type { ResizeEdge } from '../getResizeProps'
import type { ResizeHost } from '../resizeController'
import type { Event, Resource } from '../types'
import type { Calendar_Internal } from '../types/Calendar'
import type {
  CalendarFeature,
  CalendarFeatures,
} from '../types/CalendarFeatures'
import type {
  ResizeHandleOptions,
  ResizePointerEvent,
} from './resizeFeature.types'

/**
 * Drag-to-resize. Wires a {@link ResizeController} to the feature-composed
 * instance through a {@link ResizeHost} adapter, and adds node methods:
 * `event.getResizeHandleProps(edge)` and `day.getColumnProps()`.
 *
 * Requires `eventsFeature` (reads/commits via its shared map). History is
 * checkpointed when `historyFeature` is present.
 *
 * ponytail: `validateResize` here only computes the snapped/min-duration result
 * — availability blocking is the timeline feature's job, and recurring-occurrence
 * resizes fall back to a single edit until `recurrenceFeature` lands.
 */
export const resizeFeature: CalendarFeature = {
  constructCalendarApis: <
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  >(
    calendar: Calendar_Internal<TFeatures, TResource, TEvent>,
  ) => {
    const timeZone = calendar.options.timeZone ?? 'UTC'

    const internals = calendar as unknown as {
      _eventMap: Map<string, TEvent>
      _normalizeEvent: (event: TEvent) => TEvent
      _bumpEvents: () => void
      _pushHistory?: () => void
    }

    const commitUpdate = (
      id: string,
      updates: Partial<Omit<TEvent, 'id'>>,
    ) => {
      const existing = internals._eventMap.get(id)
      if (!existing) return
      internals._pushHistory?.()
      internals._eventMap.set(
        id,
        internals._normalizeEvent({ ...existing, ...updates } as TEvent),
      )
      internals._bumpEvents()
    }

    const host: ResizeHost<TResource, TEvent> = {
      getEvents: () => calendar.getEvents(),
      getDaysWithEvents: () => calendar.getDays(),
      validateResize: (options) => ({
        blocked: false,
        result: calculateResizedEvent({
          originalStart: options.originalStart,
          originalEnd: options.originalEnd,
          edge: options.edge,
          deltaMinutes: options.totalDeltaMinutes,
          timeZone,
          constraints: options.constraints,
        }),
        targetDayDate: options.targetDayDate,
      }),
      commitUpdate,
      editRecurringEvent: (eventId, updates) => {
        commitUpdate(eventId, updates)
        return Promise.resolve({ success: true })
      },
    }

    const controller = new ResizeController<TResource, TEvent>(
      host,
      calendar.options.resize ?? {},
    )

    const resized = calendar as unknown as {
      resizeController: ResizeController<TResource, TEvent>
      getResizeState: () => ReturnType<typeof controller.getSnapshot>
    }
    resized.resizeController = controller
    resized.getResizeState = () => controller.getSnapshot()
  },

  assignEventPrototype: (prototype, calendar) => {
    const getController = () =>
      (calendar as unknown as { resizeController: ResizeController<any, any> })
        .resizeController

    prototype.getResizeHandleProps = function (
      this: { id: string; start: unknown; end: unknown },
      edge: ResizeEdge,
      options?: ResizeHandleOptions,
    ) {
      const id = this.id
      const originalStart = this.start as string
      const originalEnd = this.end as string
      return {
        onMouseDown: (event: ResizePointerEvent) => {
          const started = getController().start({
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
    const getController = () =>
      (calendar as unknown as { resizeController: ResizeController<any, any> })
        .resizeController

    prototype.getColumnProps = function (this: { isoDate: string }) {
      const isoDate = this.isoDate
      return {
        ref: (element: HTMLElement | null) => {
          getController().registerDayColumn(isoDate, element)
        },
      }
    }
  },

  destroy: (calendar) => {
    const controller = (
      calendar as unknown as {
        resizeController?: ResizeController<any, any>
      }
    ).resizeController
    controller?.destroy()
  },
}
