import type { ResizeEdge } from '../getResizeProps'
import type { ResizeController, ResizeState } from '../resizeController'
import type {
  Event,
  EventDateTimeInput,
  RecurrenceEditScope,
  Resource,
} from '../types'

export interface ResizeHandleOptions {
  occurrenceStart?: EventDateTimeInput
  recurrenceScope?: RecurrenceEditScope
}

/** Minimal pointer-event shape a resize handle's `onMouseDown` consumes. */
export interface ResizePointerEvent {
  clientX: number
  clientY: number
  target: EventTarget | null
  preventDefault: () => void
  stopPropagation: () => void
}

/** API contributed by `resizeFeature` at the instance level. */
export interface Calendar_Resize<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  /** The framework-agnostic resize controller (UI layers subscribe to it). */
  resizeController: ResizeController<TResource, TEvent>
  /** Current resize state snapshot. */
  getResizeState: () => ResizeState
}

/** Methods `resizeFeature` adds to every event node. */
export interface EventNode_Resize {
  /** Handlers for a drag-resize handle on this event's `edge`. */
  getResizeHandleProps: (
    edge: ResizeEdge,
    options?: ResizeHandleOptions,
  ) => { onMouseDown: (event: ResizePointerEvent) => void }
}

/** Methods `resizeFeature` adds to every day node. */
export interface DayNode_Resize {
  /** Props for the day's column element (registers it as a resize drop target). */
  getColumnProps: () => { ref: (element: HTMLElement | null) => void }
}
