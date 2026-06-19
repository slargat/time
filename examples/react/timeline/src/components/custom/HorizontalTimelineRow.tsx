import React, { useCallback } from 'react'
import { useDroppable } from '@dnd-kit/react'
import type { Day, Event, Resource, TimelineResourceRow } from '@tanstack/time'
import type { useCalendar } from '@tanstack/react-time'
import { RESOURCE_ZONE_COLORS, getEventColor } from '@/lib/colors'
import { DraggableTimelineEvent } from '@/components/custom/DraggableTimelineEvent'

function timeStringToFraction(time: string): number {
  const parts = time.split(':')
  const totalHours = Number(parts[0]) + Number(parts[1]) / 60
  return Math.min(totalHours, 24) / 24
}

export const HorizontalTimelineRow = React.memo(function HorizontalTimelineRow({
  row,
  days,
  resourceColorIndex,
  onEventClick,
  getResizeHandleProps,
  getDayColumnProps,
  getUnavailableRanges,
  eventBarRefs,
  rowWidthPx,
  style,
}: {
  row: TimelineResourceRow<Resource, Event<Resource>>
  days: Array<Day<Resource, Event<Resource>>>
  resourceColorIndex: number
  onEventClick: (event: Event<Resource>) => void
  getResizeHandleProps: ReturnType<
    typeof useCalendar<Resource, Event<Resource>>
  >['getResizeHandleProps']
  getDayColumnProps: ReturnType<
    typeof useCalendar<Resource, Event<Resource>>
  >['getDayColumnProps']
  getUnavailableRanges: ReturnType<
    typeof useCalendar<Resource, Event<Resource>>
  >['getUnavailableRanges']
  eventBarRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  rowWidthPx: number
  style?: React.CSSProperties
}) {
  const { ref: setDroppableRef } = useDroppable({
    id: `resource-${row.resource.id}`,
    data: { resource: row.resource },
  })

  const dayPercentage = 100 / days.length
  const zoneColor =
    RESOURCE_ZONE_COLORS[resourceColorIndex % RESOURCE_ZONE_COLORS.length] ??
    RESOURCE_ZONE_COLORS[0]

  const registerEventBar = useCallback(
    (eventId: string) => (el: HTMLDivElement | null) => {
      if (el) {
        eventBarRefs.current.set(eventId, el)
      } else {
        eventBarRefs.current.delete(eventId)
      }
    },
    [eventBarRefs],
  )

  return (
    <div
      ref={setDroppableRef}
      className="relative border-b border-neutral-800/50"
      style={{ minHeight: '56px', width: rowWidthPx, ...style }}
    >
      {days.map((day, i) => {
        const unavailableRanges = getUnavailableRanges(day.isoDate, {
          resourceIds: [row.resource.id],
        })

        return (
          <div
            key={day.isoDate}
            className={`absolute top-0 bottom-0 border-r border-neutral-800/30 ${
              day.isToday ? 'bg-neutral-800/20' : ''
            }`}
            style={{
              left: `${i * dayPercentage}%`,
              width: `${dayPercentage}%`,
            }}
            {...getDayColumnProps(day.isoDate)}
          >
            {Array.from({ length: 23 }, (_, h) => (
              <div
                key={h}
                className="absolute top-0 bottom-0 border-r border-neutral-800/10"
                style={{ left: `${((h + 1) / 24) * 100}%` }}
              />
            ))}
            {unavailableRanges.map((range, rangeIdx) => {
              const startFraction = timeStringToFraction(range.startTime)
              const endFraction = timeStringToFraction(range.endTime)
              return (
                <div
                  key={rangeIdx}
                  className="absolute top-0 bottom-0 pointer-events-none z-0 bg-[length:8px_8px]"
                  style={{
                    left: `${startFraction * 100}%`,
                    width: `${(endFraction - startFraction) * 100}%`,
                    backgroundImage: `repeating-linear-gradient(315deg, ${zoneColor} 0, ${zoneColor} 1px, transparent 0, transparent 50%)`,
                  }}
                  title={`Unavailable — ${row.resource.label}: ${range.startTime}–${range.endTime}`}
                />
              )
            })}
          </div>
        )
      })}
      {row.events.map(
        ({ event, left, width, lane, isStartClipped, isEndClipped }) => {
          const color = getEventColor(event.id)

          return (
            <DraggableTimelineEvent
              key={event.id}
              event={event}
              left={left}
              width={width}
              lane={lane}
              laneCount={row.laneCount}
              isStartClipped={isStartClipped}
              isEndClipped={isEndClipped}
              color={color}
              registerEventBar={registerEventBar}
              onEventClick={onEventClick}
              getResizeHandleProps={getResizeHandleProps}
            />
          )
        },
      )}
    </div>
  )
})
