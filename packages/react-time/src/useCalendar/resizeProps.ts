import type { MouseEvent as ReactMouseEvent } from 'react'
import type {
  Event,
  EventDateTimeInput,
  RecurrenceEditScope,
  ResizeController,
  ResizeEdge,
  Resource,
} from '@tanstack/time'

export interface ResizeHandleHandlers {
  onMouseDown: (e: ReactMouseEvent) => void
}

export interface ResizeHandleOptions {
  occurrenceStart?: EventDateTimeInput
  recurrenceScope?: RecurrenceEditScope
}

export interface DayColumnProps {
  ref: (element: HTMLElement | null) => void
}

export type GetResizeHandleProps = (
  eventId: string,
  edge: ResizeEdge,
  originalStart: string,
  originalEnd: string,
  options?: ResizeHandleOptions,
) => ResizeHandleHandlers

export type GetDayColumnProps = (dayDate: string) => DayColumnProps

export function createGetResizeHandleProps<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  resizeController: ResizeController<TResource, TEvent>,
  cache: Map<string, ResizeHandleHandlers>,
): GetResizeHandleProps {
  return (eventId, edge, originalStart, originalEnd, handleOptions) => {
    const key = `${eventId}|${edge}|${originalStart}|${originalEnd}|${handleOptions?.occurrenceStart ?? ''}|${handleOptions?.recurrenceScope ?? ''}`
    const cached = cache.get(key)
    if (cached) return cached

    const handlers: ResizeHandleHandlers = {
      onMouseDown: (e) => {
        const started = resizeController.start({
          eventId,
          edge,
          originalStart,
          originalEnd,
          occurrenceStart: handleOptions?.occurrenceStart,
          recurrenceScope: handleOptions?.recurrenceScope,
          clientX: e.clientX,
          clientY: e.clientY,
          target: e.target as HTMLElement | null,
        })
        if (!started) return

        e.preventDefault()
        e.stopPropagation()
      },
    }

    cache.set(key, handlers)
    return handlers
  }
}

export function createGetDayColumnProps<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>(
  resizeController: ResizeController<TResource, TEvent>,
  cache: Map<string, DayColumnProps>,
): GetDayColumnProps {
  return (dayDate) => {
    const cached = cache.get(dayDate)
    if (cached) return cached

    const props: DayColumnProps = {
      ref: (element) => {
        resizeController.registerDayColumn(dayDate, element)
      },
    }
    cache.set(dayDate, props)
    return props
  }
}
