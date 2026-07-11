import type { ResizeEdge } from './get-resize-props'
import type { ResizeController, ResizeState } from './resize-controller'
import type { CalendarFeatures } from '../../types/calendar-features'
import type {
  Event,
  EventDateTimeInput,
  RecurrenceEditScope,
  Resource,
} from '../../types'

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

declare module '../../types/calendar' {
  interface Calendar_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    resizeFeature: {
      /** Framework-agnostic resize controller (UI layers subscribe to it). */
      resizeController: ResizeController<TResource, TEvent>
      /** Current resize state snapshot. */
      getResizeState: () => ResizeState
    }
  }

  interface EventNode_FeatureMap<
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    resizeFeature: {
      getResizeHandleProps: (
        edge: ResizeEdge,
        options?: ResizeHandleOptions,
      ) => { onMouseDown: (event: ResizePointerEvent) => void }
    }
  }

  interface DayNode_FeatureMap<
    TFeatures extends CalendarFeatures,
    TResource extends Resource,
    TEvent extends Event<TResource>,
  > {
    resizeFeature: {
      getColumnProps: () => { ref: (element: HTMLElement | null) => void }
    }
  }
}
