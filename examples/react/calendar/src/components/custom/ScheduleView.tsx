import {
  calculateGhostPreviewStyle,
  calculateSegmentResizePreview,
  formatEventTimeRange,
  useCalendar,
} from '@tanstack/react-time'
import type { Day, Event, Resource } from '@tanstack/time'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { ResizeHandle } from '@/components/custom/ResizeHandle'

const RESOURCE_COLORS = ['#0049af75', '#00af3475']

interface ScheduleViewProps {
  calendar: ReturnType<typeof useCalendar<Resource, Event<Resource>>>
  days: Array<Day<Resource, Event<Resource>>>
  resources: Array<Resource>
  onEventClick: (event: Event<Resource>) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  leftSentinelRef: React.RefObject<HTMLDivElement | null>
  rightSentinelRef: React.RefObject<HTMLDivElement | null>
  periodDayCount: number
}

export function ScheduleView({
  calendar,
  days,
  resources,
  onEventClick,
  scrollRef,
  leftSentinelRef,
  rightSentinelRef,
  periodDayCount,
}: ScheduleViewProps) {
  const timeSlots = calendar.getTimeSlots()
  const {
    resizeState,
    getResizeHandleProps,
    getDayColumnProps,
    getUnavailableRanges,
  } = calendar

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
      <div className="border-b border-neutral-800 bg-neutral-950 px-4 py-3">
        <div className="flex gap-6 flex-wrap">
          {resources.map((resource, idx) => {
            const color = RESOURCE_COLORS[idx % RESOURCE_COLORS.length]
            return (
              <div key={resource.id} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{
                    backgroundColor: color,
                    backgroundImage: `repeating-linear-gradient(315deg, ${color} 0, ${color} 1px, transparent 0, transparent 50%)`,
                  }}
                />
                <span className="text-sm text-neutral-300">
                  {resource.label}
                </span>
                {resource.capacity !== undefined && (
                  <span className="text-xs text-neutral-500">
                    (Capacity: {resource.capacity})
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex border-t border-neutral-800">
        <div className="w-20 border-r border-neutral-800 bg-neutral-950">
          <div className="h-12 border-b border-neutral-800"></div>
          {timeSlots.map((slot) => (
            <div
              key={`${slot.hour}-${slot.minute}`}
              className="h-[60px] border-b border-neutral-800/50 px-2 py-1 text-xs text-neutral-500"
            >
              {slot.label}
            </div>
          ))}
        </div>
        {/* Horizontal-scrollable schedule body — sentinels auto-navigate on edge */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `1px repeat(${days.length}, 1fr) 1px`,
              minWidth: `${(days.length / periodDayCount) * 100}%`,
            }}
          >
            <div ref={leftSentinelRef} style={{ width: 1 }} aria-hidden />
            <div className="contents">
              {days.map((day) => {
                const dayDate = `${day.date.year}-${String(day.date.month).padStart(2, '0')}-${String(day.date.day).padStart(2, '0')}`
                const dayName = new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                }).format(
                  new Date(day.date.year, day.date.month - 1, day.date.day),
                )
                return (
                  <div
                    key={day.date.toString()}
                    className="border-r border-neutral-800 last:border-r-0"
                    {...getDayColumnProps(dayDate)}
                  >
                    <div className="h-12 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-center">
                      <div className="text-sm font-semibold text-neutral-200">
                        {dayName}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {day.date.day}
                      </div>
                    </div>
                    <div className="relative h-[1440px] bg-neutral-950/30">
                      {resources.map((resource, resourceIdx) => {
                        const resourceRanges = getUnavailableRanges(dayDate, {
                          resourceIds: [resource.id],
                        })
                        const color =
                          RESOURCE_COLORS[resourceIdx % RESOURCE_COLORS.length]

                        return resourceRanges.map((range, rangeIdx) => (
                          <div
                            key={`${resource.id}-${rangeIdx}`}
                            className="absolute left-0 right-0 pointer-events-none z-0 bg-[length:10px_10px] bg-fixed"
                            style={{
                              top: `${range.top}px`,
                              height: `${range.height}px`,
                              backgroundImage: `repeating-linear-gradient(315deg, ${color} 0, ${color} 1px, transparent 0, transparent 50%)`,
                            }}
                            title={`Unavailable - ${resource.label}`}
                          />
                        ))
                      })}
                      {day.events.map((event, eventIndex) => {
                        const eventProps = calendar.getEventProps(event)
                        const { style, isSplitEvent } = eventProps

                        const segmentInfo = calendar.getEventSegmentInfo(event)
                        const {
                          isFirstSegment,
                          isLastSegment,
                          originalStart,
                          originalEnd,
                        } = segmentInfo

                        const isBeingResized =
                          resizeState.isResizing &&
                          resizeState.eventId === event.id

                        const resizePreview =
                          isBeingResized &&
                          resizeState.previewStart &&
                          resizeState.previewEnd
                            ? calculateSegmentResizePreview({
                                dayDate,
                                originalStart,
                                originalEnd,
                                previewStart: resizeState.previewStart,
                                previewEnd: resizeState.previewEnd,
                              })
                            : null

                        if (resizePreview?.shouldHide) {
                          return null
                        }

                        const displayStyle = resizePreview?.previewStyle
                          ? { ...style, ...resizePreview.previewStyle }
                          : style

                        const showTopHandle = !isSplitEvent || isFirstSegment
                        const showBottomHandle = !isSplitEvent || isLastSegment
                        const isActivelyResized =
                          isBeingResized && resizePreview?.previewStyle !== null

                        const timeRange = formatEventTimeRange(
                          isBeingResized && resizeState.previewStart
                            ? resizeState.previewStart
                            : originalStart,
                          isBeingResized && resizeState.previewEnd
                            ? resizeState.previewEnd
                            : originalEnd,
                        )

                        return (
                          <ContextMenu key={`${event.id}-${eventIndex}`}>
                            <ContextMenuTrigger
                              className={`group absolute z-10 bg-neutral-800 text-white rounded px-2 py-1 text-xs font-medium overflow-hidden transition-colors border border-neutral-700 ${
                                isActivelyResized
                                  ? 'bg-neutral-700 ring-2 ring-neutral-500 z-20'
                                  : 'cursor-pointer hover:bg-neutral-700'
                              }`}
                              style={displayStyle as React.CSSProperties}
                              onClick={(e: React.MouseEvent) => {
                                if (
                                  !resizeState.isResizing &&
                                  !(e.target as HTMLElement).closest(
                                    '[data-resize-handle]',
                                  )
                                ) {
                                  onEventClick(event)
                                }
                              }}
                            >
                              {showTopHandle && (
                                <ResizeHandle
                                  edge="top"
                                  {...getResizeHandleProps(
                                    event.id,
                                    'top',
                                    originalStart,
                                    originalEnd,
                                  )}
                                />
                              )}
                              <div className="font-semibold pt-1 flex items-center gap-1.5">
                                <span className="flex items-center gap-1 min-w-0">
                                  {event.recurrence && (
                                    <span
                                      className="opacity-60 flex-shrink-0"
                                      title="Recurring event"
                                    >
                                      ↻
                                    </span>
                                  )}
                                  <span className="truncate">
                                    {event.title}
                                  </span>
                                </span>
                                {event.consumption &&
                                  event.consumption.length > 0 && (
                                    <span
                                      className="text-[10px] leading-none rounded bg-black/40 px-1 py-0.5 font-semibold flex-shrink-0"
                                      title="Consumption"
                                    >
                                      {event.consumption.reduce(
                                        (a, b) => a + b,
                                        0,
                                      )}
                                    </span>
                                  )}
                              </div>
                              {displayStyle &&
                                parseFloat(displayStyle.height) > 2 && (
                                  <div className="text-xs opacity-90 mt-0.5">
                                    {timeRange.rangeFormatted}
                                  </div>
                                )}
                              {showBottomHandle && (
                                <ResizeHandle
                                  edge="bottom"
                                  {...getResizeHandleProps(
                                    event.id,
                                    'bottom',
                                    originalStart,
                                    originalEnd,
                                  )}
                                />
                              )}
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onClick={() => onEventClick(event)}
                              >
                                Edit event
                              </ContextMenuItem>
                              {event.recurrence && (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() =>
                                      calendar.goToPreviousOccurrence(
                                        event.id,
                                        event.start,
                                      )
                                    }
                                  >
                                    ← Previous occurrence
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() =>
                                      calendar.goToNextOccurrence(
                                        event.id,
                                        event.start,
                                      )
                                    }
                                  >
                                    Next occurrence →
                                  </ContextMenuItem>
                                </>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        )
                      })}
                      {resizeState.isResizing &&
                        resizeState.previewStart &&
                        resizeState.previewEnd &&
                        !day.events.some((e) => e.id === resizeState.eventId) &&
                        (() => {
                          const ghostStyle = calculateGhostPreviewStyle({
                            dayDate,
                            previewStart: resizeState.previewStart,
                            previewEnd: resizeState.previewEnd,
                          })

                          if (!ghostStyle) return null

                          const timeRange = formatEventTimeRange(
                            resizeState.previewStart,
                            resizeState.previewEnd,
                          )

                          return (
                            <div
                              className="absolute bg-neutral-700/60 text-neutral-200 rounded px-2 py-1 text-xs font-medium overflow-hidden border border-neutral-600 border-dashed z-20"
                              style={ghostStyle}
                            >
                              <div className="font-semibold pt-1 opacity-80">
                                {timeRange.rangeFormatted}
                              </div>
                            </div>
                          )
                        })()}
                    </div>
                  </div>
                )
              })}
            </div>
            <div ref={rightSentinelRef} style={{ width: 1 }} aria-hidden />
          </div>
        </div>
      </div>
    </div>
  )
}
