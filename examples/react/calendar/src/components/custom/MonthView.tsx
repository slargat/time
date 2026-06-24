import { useCalendarContext, useMonthGrid } from '@tanstack/react-time'
import type { Day, Event, Resource } from '@tanstack/time'
import { Badge } from '@/components/ui/badge'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface MonthViewProps {
  weekGroups: Array<Array<Day<Resource, Event<Resource>> | null>>
  scrollRef: React.RefObject<HTMLDivElement | null>
  topSentinelRef: React.RefObject<HTMLDivElement | null>
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>
  onEventClick: (event: Event<Resource>) => void
}

export function MonthView({
  weekGroups,
  scrollRef,
  topSentinelRef,
  bottomSentinelRef,
  onEventClick,
}: MonthViewProps) {
  const { core } = useCalendarContext<Resource, Event<Resource>>()
  const { dayNames, getDayProps, getEventProps } = useMonthGrid<
    Resource,
    Event<Resource>
  >({ onEventClick })

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
      {/* Sticky day-name header */}
      <div
        className="grid border-b border-neutral-800 bg-neutral-950 sticky top-0 z-10"
        style={{ gridTemplateColumns: `repeat(${dayNames.length}, 1fr)` }}
      >
        {dayNames.map((dayName, index) => (
          <div
            key={index}
            className={`py-3 text-center font-semibold text-sm text-neutral-500 ${
              index < dayNames.length - 1
                ? 'border-r border-neutral-800'
                : ''
            }`}
          >
            {dayName}
          </div>
        ))}
      </div>

      {/* Scrollable month body — sentinels trigger period navigation */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        {/* Top sentinel: triggers goToPreviousPeriod */}
        <div ref={topSentinelRef} style={{ height: 1 }} aria-hidden />

        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${dayNames.length}, 1fr)` }}
        >
          {weekGroups.map((week, weekIndex) => {
            const weekKey =
              week.find((d) => d !== null)?.isoDate ?? `w-${weekIndex}`
            return week.map((day, dayIndex) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${weekKey}-${dayIndex}`}
                    className={`h-[120px] bg-neutral-950/50 ${
                      dayIndex < dayNames.length - 1
                        ? 'border-r border-neutral-800'
                        : ''
                    } border-b border-neutral-800`}
                  />
                )
              }

              const { key: dayKey, ...dayAttributes } = getDayProps(day)
              const isToday = day.isToday
              const isInCurrentPeriod = day.isInCurrentPeriod

              return (
                <div
                  key={dayKey}
                  {...dayAttributes}
                  className={`h-[120px] p-2 relative flex flex-col overflow-hidden ${
                    dayIndex < dayNames.length - 1
                      ? 'border-r border-neutral-800'
                      : ''
                  } border-b border-neutral-800 ${
                    isToday
                      ? 'bg-neutral-900'
                      : isInCurrentPeriod
                        ? 'bg-black'
                        : 'bg-neutral-950/50'
                  }`}
                >
                  <div
                    className={`text-sm mb-1 flex-shrink-0 ${
                      isToday
                        ? 'font-bold text-white'
                        : isInCurrentPeriod
                          ? 'font-medium text-neutral-200'
                          : 'font-medium text-neutral-500'
                    }`}
                  >
                    {day.date.day}
                  </div>
                  <div className="flex flex-col gap-1 overflow-hidden flex-1 min-h-0">
                    {day.events.slice(0, 3).map((event) => {
                      const { key: eventKey, ...eventAttributes } =
                        getEventProps(event)
                      return (
                        <ContextMenu key={eventKey}>
                          <ContextMenuTrigger className="contents">
                            <Badge
                              {...eventAttributes}
                              variant="secondary"
                              className="cursor-pointer hover:bg-muted flex items-center gap-1.5 max-w-full flex-shrink-0 w-full"
                              title={event.title}
                            >
                              <span className="flex items-center gap-1 min-w-0">
                                {event.recurrence && (
                                  <span
                                    className="opacity-60 flex-shrink-0"
                                    title="Recurring event"
                                  >
                                    ↻
                                  </span>
                                )}
                                <span className="truncate">{event.title}</span>
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
                            </Badge>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => onEventClick(event)}>
                              Edit event
                            </ContextMenuItem>
                            {event.recurrence && (
                              <>
                                <ContextMenuSeparator />
                                <ContextMenuItem
                                  onClick={() =>
                                    core.goToPreviousOccurrence(
                                      event.id,
                                      event.start,
                                    )
                                  }
                                >
                                  ← Previous occurrence
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() =>
                                    core.goToNextOccurrence(
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
                    {day.events.length > 3 && (
                      <div className="text-[10px] text-neutral-400 px-1 flex-shrink-0">
                        +{day.events.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          })}
        </div>

        {/* Bottom sentinel: triggers goToNextPeriod */}
        <div ref={bottomSentinelRef} style={{ height: 1 }} aria-hidden />
      </div>
    </div>
  )
}
