import {
  calculateGhostPreviewStyle,
  calculateSegmentResizePreview,
  formatEventTimeRange,
} from '@tanstack/react-time'
import { EventContextMenuItems } from './EventContextMenu'
import type { Event, RecurrenceEditScope, Resource } from '@tanstack/time'
import type { CalendarDay, CalendarInstance } from '@/lib/calendar'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ResizeHandleProps {
  edge: 'top' | 'bottom'
  /**
   * When the event is too short to host two stacked handles inside it, float
   * the handle just outside the box (above for top, below for bottom) so the
   * two handles never overlap and the event stays resizable at any height.
   */
  floating?: boolean
  onMouseDown: (e: React.MouseEvent) => void
}

function ResizeHandle({ edge, floating, onMouseDown }: ResizeHandleProps) {
  const edgePosition = floating
    ? edge === 'top'
      ? '-top-3'
      : '-bottom-3'
    : edge === 'top'
      ? 'top-0'
      : 'bottom-0'

  return (
    <div
      data-resize-handle
      className={`absolute left-0 right-0 h-3 cursor-ns-resize z-30 bg-transparent hover:bg-neutral-500/30 pointer-events-auto ${edgePosition}`}
      onMouseDown={onMouseDown}
      onClick={(e) => {
        e.stopPropagation()
      }}
      style={{ touchAction: 'none' }}
    >
      <div
        className={`absolute left-1/2 -translate-x-1/2 w-8 h-1 bg-neutral-400 rounded opacity-50 group-hover:opacity-100 transition-opacity ${
          edge === 'top' ? 'top-1' : 'bottom-1'
        }`}
      />
    </div>
  )
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
}: {
  calendar: CalendarInstance
  days: Array<CalendarDay>
  resources: Array<Resource>
  onEventClick: (event: Event<Resource>, scope?: RecurrenceEditScope) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  leftSentinelRef: React.RefObject<HTMLDivElement | null>
  rightSentinelRef: React.RefObject<HTMLDivElement | null>
  periodDayCount: number
}) {
  const timeSlots = calendar.getTimeSlots()
  const resizeState = calendar.getResizeState()
  const getUnavailableRanges = calendar.getUnavailableRanges

  const maxAllDay = days.reduce((m, d) => Math.max(m, d.allDayEvents.length), 0)
  const allDayRowHeight = maxAllDay > 0 ? maxAllDay * 24 + 8 : 28

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
      <div className="border-b border-neutral-800 bg-neutral-950 px-4 py-3">
        <div className="flex gap-6 flex-wrap">
          {resources.map((resource, idx) => {
            const colors = ['#0049af75', '#00af3475']
            const color = colors[idx % colors.length]
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
          <div
            className="border-b border-neutral-800 px-2 py-1 text-[10px] uppercase tracking-wide text-neutral-500 flex items-center"
            style={{ height: allDayRowHeight }}
          >
            all-day
          </div>
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
        <ScrollArea viewportRef={scrollRef} className="flex-1">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `1px repeat(${days.length}, minmax(0, 1fr)) 1px`,
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
                    {...day.getColumnProps()}
                  >
                    <div className="h-12 border-b border-neutral-800 bg-neutral-950 px-3 py-2 text-center">
                      <div className="text-sm font-semibold text-neutral-200">
                        {dayName}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {day.date.day}
                      </div>
                    </div>
                    <div
                      className="border-b border-neutral-800 bg-neutral-950/60 px-1 py-1 flex flex-col gap-1 overflow-hidden"
                      style={{ height: allDayRowHeight }}
                    >
                      {day.allDayEvents.map((event) => (
                        <div
                          key={`ad-${event.id}`}
                          className="cursor-pointer bg-amber-700/70 hover:bg-amber-600/80 text-amber-50 rounded px-2 text-[11px] font-medium truncate border border-amber-600/40"
                          style={{ height: 20, lineHeight: '20px' }}
                          title={event.title}
                          onClick={() => onEventClick(event)}
                        >
                          {event.title}
                        </div>
                      ))}
                    </div>
                    <div className="relative h-[1440px] bg-neutral-950/30">
                      {resources.map((resource, resourceIdx) => {
                        const resourceRanges = getUnavailableRanges(dayDate, {
                          resourceIds: [resource.id],
                        })
                        const colors = ['#0049af75', '#00af3475']
                        const color = colors[resourceIdx % colors.length]

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

                        // Events render at their true height (no min-height
                        // floor). A very short event can't host two stacked
                        // 12px handles inside it without them overlapping and
                        // stealing each other's clicks — so for those, float
                        // the handles just outside the box. Still resizable.
                        const RESIZE_HANDLE_PX = 12 // ResizeHandle `h-3`
                        const DAY_COLUMN_HEIGHT_PX = 1440 // the `h-[1440px]` grid
                        const renderedHeightPx = style?.height
                          ? (parseFloat(style.height) / 100) *
                            DAY_COLUMN_HEIGHT_PX
                          : Infinity
                        const floatHandles =
                          renderedHeightPx < RESIZE_HANDLE_PX * 2

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
                              className={`group absolute z-10 bg-neutral-800 text-white rounded px-2 py-1 text-xs font-medium transition-colors border border-neutral-700 ${
                                // Floating handles sit outside the box, so they
                                // must not be clipped.
                                floatHandles ? '' : 'overflow-hidden'
                              } ${
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
                                  floating={floatHandles}
                                  {...event.getResizeHandleProps('top', {
                                    occurrenceStart:
                                      event._occurrenceOriginalStart,
                                  })}
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
                                  floating={floatHandles}
                                  {...event.getResizeHandleProps('bottom', {
                                    occurrenceStart:
                                      event._occurrenceOriginalStart,
                                  })}
                                />
                              )}
                            </ContextMenuTrigger>
                            <EventContextMenuItems
                              event={event}
                              calendar={calendar}
                              onEdit={onEventClick}
                            />
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
        </ScrollArea>
      </div>
    </div>
  )
}
