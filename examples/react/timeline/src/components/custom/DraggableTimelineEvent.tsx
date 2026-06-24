import React from 'react'
import { useDraggable } from '@dnd-kit/react'
import {
  toPlainDateString,
  toPlainDateTimeString,
  toPlainTimeString,
} from '@tanstack/time'
import type { Event, Resource } from '@tanstack/time'
import type { useCalendar } from '@tanstack/react-time'
import { EVENT_GAP_PX } from '@/lib/constants'
import type { EventColor } from '@/lib/colors'
import { HorizontalResizeHandle } from '@/components/custom/HorizontalResizeHandle'

export const DraggableTimelineEvent = React.memo(function DraggableTimelineEvent({
  event,
  left,
  width,
  lane,
  laneCount,
  isStartClipped,
  isEndClipped,
  color,
  registerEventBar,
  onEventClick,
  getResizeHandleProps,
}: {
  event: Event<Resource>
  left: number
  width: number
  lane: number
  laneCount: number
  isStartClipped: boolean
  isEndClipped: boolean
  color: EventColor
  registerEventBar: (eventId: string) => (el: HTMLDivElement | null) => void
  onEventClick: (event: Event<Resource>) => void
  getResizeHandleProps: ReturnType<typeof useCalendar>['getResizeHandleProps']
}) {
  const laneHeightPct = 100 / laneCount
  const topPct = lane * laneHeightPct

  const {
    ref: setDraggableRef,
    handleRef: setDragHandleRef,
    isDragging,
  } = useDraggable({
    id: `event-${event.id}`,
    data: { event, left, width, laneHeightPct, topPct, lane, color },
  })

  const depCount = event.dependsOn?.length ?? 0

  return (
    <div
      ref={(el) => {
        registerEventBar(event.id)(el)
        setDraggableRef(el)
      }}
      data-event-id={event.id}
      data-left={left}
      data-width={width}
      className={`group absolute border ${color.bg} ${color.border} ${color.text} flex items-center text-xs font-medium overflow-hidden shadow-sm z-30 cursor-pointer hover:brightness-110 transition-[filter] pointer-events-auto ${
        isDragging ? 'opacity-40 shadow-xl z-50' : ''
      } ${
        !isStartClipped && !isEndClipped
          ? 'rounded-md'
          : !isStartClipped
            ? 'rounded-l-md'
            : !isEndClipped
              ? 'rounded-r-md'
              : ''
      }`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `calc(${topPct}% + ${EVENT_GAP_PX}px)`,
        height: `calc(${laneHeightPct}% - ${EVENT_GAP_PX * 2}px)`,
      }}
      title={`${event.title} (${toPlainDateString(event.start)}T${toPlainTimeString(event.start)} → ${toPlainDateString(event.end)}T${toPlainTimeString(event.end)})`}
      onClick={(e) => {
        if (
          !(e.target as HTMLElement).closest('[data-drag-handle]') &&
          !(e.target as HTMLElement).closest('[data-resize-handle]')
        ) {
          e.stopPropagation()
          onEventClick(event)
        }
      }}
    >
      {!isStartClipped && (
        <HorizontalResizeHandle
          edge="left"
          {...getResizeHandleProps(
            event.id,
            'left',
            toPlainDateTimeString(event.start),
            toPlainDateTimeString(event.end),
          )}
        />
      )}
      <div
        ref={setDragHandleRef}
        data-drag-handle
        className="relative ml-3 w-4 h-full flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity z-40"
        title="Drag to move"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="2" cy="2" r="1.5" />
          <circle cx="6" cy="2" r="1.5" />
          <circle cx="10" cy="2" r="1.5" />
          <circle cx="2" cy="6" r="1.5" />
          <circle cx="6" cy="6" r="1.5" />
          <circle cx="10" cy="6" r="1.5" />
          <circle cx="2" cy="10" r="1.5" />
          <circle cx="6" cy="10" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
        </svg>
      </div>
      <div className="flex-1 h-full min-w-0 flex items-center gap-1.5 px-2.5 cursor-pointer">
        <span className="truncate">{event.title}</span>
        {depCount > 0 && (
          <span
            className="flex-shrink-0 text-[10px] leading-none rounded bg-amber-500/40 border border-amber-300/60 px-1 py-0.5 font-semibold"
            title={`${depCount} dependenc${depCount === 1 ? 'y' : 'ies'}`}
          >
            ↳{depCount}
          </span>
        )}
        {event.consumption && event.consumption.length > 0 && (
          <span
            className="flex-shrink-0 text-[10px] leading-none rounded bg-black/30 px-1 py-0.5 font-semibold"
            title="Consumption"
          >
            {event.consumption.reduce((a, b) => a + b, 0)}
          </span>
        )}
      </div>
      {!isEndClipped && (
        <HorizontalResizeHandle
          edge="right"
          {...getResizeHandleProps(
            event.id,
            'right',
            toPlainDateTimeString(event.start),
            toPlainDateTimeString(event.end),
          )}
        />
      )}
    </div>
  )
})
