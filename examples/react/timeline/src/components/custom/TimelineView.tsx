import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { DragDropProvider, DragOverlay } from '@dnd-kit/react'
import {
  calculateTimelineResizePreview,
  useCalendar,
} from '@tanstack/react-time'
import {
  getTimeClient,
  toPlainDateString,
  toPlainTimeString,
} from '@tanstack/time'
import { useVirtualizer } from '@tanstack/react-virtual'
import type {
  DependencyType,
  Event,
  ResizeError,
  Resource,
} from '@tanstack/time'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DependencyTypeModal } from '@/components/custom/DependencyTypeModal'
import { EventModal } from '@/components/custom/EventModal'
import { HorizontalTimelineRow } from '@/components/custom/HorizontalTimelineRow'
import { ResizeErrorToast } from '@/components/custom/ResizeErrorToast'
import { TimelineDependencyOverlay } from '@/components/custom/TimelineDependencyOverlay'
import { useTimelineViewport } from '@/hooks/useTimelineViewport'
import { MOCK_DB, sampleResources } from '@/data/samples'
import { RESOURCE_ZONE_COLORS, getEventColor } from '@/lib/colors'
import { ALL_DEP_TYPES, DEP_TYPE_STYLES } from '@/lib/dep-styles'
import {
  EVENT_GAP_PX,
  MIN_DAY_WIDTH_PX,
  ROW_HEIGHT_PX,
} from '@/lib/constants'
import { emptyFormData } from '@/types'
import type { EventFormData } from '@/types'

interface PendingDependency {
  sourceId: string
  targetId: string
  sourceAnchor: 'start' | 'end'
  targetAnchor: 'start' | 'end'
  sourceTitle: string
  targetTitle: string
  suggestedType: DependencyType
}

interface ActiveDragEventData {
  event: Event<Resource>
  width: number
  laneHeightPct: number
  color: ReturnType<typeof getEventColor>
}

export function TimelineView() {
  const [modalState, setModalState] = useState<{
    isOpen: boolean
    mode: 'add' | 'edit'
    eventId?: string
    initialData: EventFormData
  }>({ isOpen: false, mode: 'add', initialData: emptyFormData })

  const [resizeError, setResizeError] = useState<ResizeError | null>(null)
  const [pendingDep, setPendingDep] = useState<PendingDependency | null>(null)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const timelineContentRef = useRef<HTMLDivElement>(null)
  const containerWidthRef = useRef(0)
  const viewportWidth = useTimelineViewport(scrollContainerRef)

  const calendar = useCalendar<Resource, Event<Resource>>({
    viewMode: { value: 1, unit: 'week' },
    events: [],
    resources: sampleResources,
    timeZone: 'UTC',
    fetchEvents: async ({ start, end }) => {
      // Simulate network latency
      await new Promise((resolve) => setTimeout(resolve, 800))

      const startDate = new Date(start)
      const endDate = new Date(end)

      return MOCK_DB.filter((e) => {
        const eStart = new Date(e.start as string)
        const eEnd = new Date(e.end as string)
        return eStart <= endDate && eEnd >= startDate
      })
    },
    resize: {
      enabled: true,
      get containerWidth() {
        return containerWidthRef.current
      },
      orientation: 'horizontal',
      constraints: {
        minDurationMinutes: 15,
        snapToMinutes: 15,
      },
      onResizeError: (error) => {
        setResizeError(error)
      },
    },
  })

  const horizNavCooldownRef = useRef(false)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const onScroll = () => {
      if (horizNavCooldownRef.current) return
      const { scrollLeft, scrollWidth, clientWidth } = container

      if (
        scrollLeft + clientWidth >= scrollWidth - 8 &&
        calendar.canGoNextPeriod()
      ) {
        horizNavCooldownRef.current = true
        calendar.goToNextPeriod()
        requestAnimationFrame(() => {
          container.scrollLeft = 0
          setTimeout(() => {
            horizNavCooldownRef.current = false
          }, 1000)
        })
      } else if (
        scrollLeft <= 8 &&
        scrollWidth > clientWidth &&
        calendar.canGoPreviousPeriod()
      ) {
        horizNavCooldownRef.current = true
        calendar.goToPreviousPeriod()
        requestAnimationFrame(() => {
          container.scrollLeft = container.scrollWidth - container.clientWidth
          setTimeout(() => {
            horizNavCooldownRef.current = false
          }, 1000)
        })
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [calendar])

  const timelineLayout = useMemo(
    () => calendar.getTimelineLayout(),
    [calendar.days],
  )

  const dayWidthPx = Math.max(
    MIN_DAY_WIDTH_PX,
    viewportWidth > 0 && calendar.days.length > 0
      ? viewportWidth / calendar.days.length
      : MIN_DAY_WIDTH_PX,
  )
  const totalContentWidthPx = calendar.days.length * dayWidthPx

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: calendar.days.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => dayWidthPx,
    overscan: 2,
  })

  useLayoutEffect(() => {
    columnVirtualizer.measure()
  }, [dayWidthPx, columnVirtualizer])

  const rowVirtualizer = useVirtualizer({
    count: timelineLayout.rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 3,
  })

  useEffect(() => {
    containerWidthRef.current = totalContentWidthPx
  }, [totalContentWidthPx])

  const eventBarRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const rowsContainerRef = useRef<HTMLDivElement>(null)

  const firstDayIso = useMemo(
    () => calendar.days[0]?.isoDate ?? '',
    [calendar.days],
  )

  const totalDays = calendar.days.length
  const { resizeState } = calendar
  const prevResizedIdRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    const prevId = prevResizedIdRef.current

    if (prevId && (!resizeState.isResizing || resizeState.eventId !== prevId)) {
      const prevEl = eventBarRefsMap.current.get(prevId)
      if (prevEl) {
        prevEl.classList.remove(
          'ring-2',
          'ring-neutral-500',
          'z-20',
          'brightness-110',
        )
      }
      prevResizedIdRef.current = null
    }

    if (
      !resizeState.isResizing ||
      !resizeState.eventId ||
      !resizeState.previewStart ||
      !resizeState.previewEnd ||
      !firstDayIso
    ) {
      return
    }

    const el = eventBarRefsMap.current.get(resizeState.eventId)
    if (!el) return

    const preview = calculateTimelineResizePreview({
      previewStart: resizeState.previewStart,
      previewEnd: resizeState.previewEnd,
      firstDayIso,
      totalDays,
    })

    el.style.left = preview.left
    el.style.width = preview.width
    el.classList.add('ring-2', 'ring-neutral-500', 'z-20', 'brightness-110')
    prevResizedIdRef.current = resizeState.eventId
  }, [resizeState, firstDayIso, totalDays])

  const inferDepType = useCallback(
    (
      sourceAnchor: 'start' | 'end',
      targetAnchor: 'start' | 'end',
    ): DependencyType => {
      if (sourceAnchor === 'end' && targetAnchor === 'start') return 'FS'
      if (sourceAnchor === 'start' && targetAnchor === 'start') return 'SS'
      if (sourceAnchor === 'end' && targetAnchor === 'end') return 'FF'
      return 'SF'
    },
    [],
  )

  const handleDependencyDragged = useCallback(
    (
      sourceId: string,
      targetId: string,
      sourceAnchor: 'start' | 'end',
      targetAnchor: 'start' | 'end',
    ) => {
      const sourceEvent = calendar.getEvents().find((e) => e.id === sourceId)
      const targetEvent = calendar.getEvents().find((e) => e.id === targetId)
      if (!sourceEvent || !targetEvent) return

      setPendingDep({
        sourceId,
        targetId,
        sourceAnchor,
        targetAnchor,
        sourceTitle: sourceEvent.title,
        targetTitle: targetEvent.title,
        suggestedType: inferDepType(sourceAnchor, targetAnchor),
      })
    },
    [calendar, inferDepType],
  )

  const finalizeDependency = useCallback(
    (type: DependencyType) => {
      if (!pendingDep) return
      const result = calendar.createDependency(
        pendingDep.sourceId,
        pendingDep.targetId,
        type,
      )
      if (result.blocked && result.error) {
        setResizeError(result.error)
      }
      setPendingDep(null)
    },
    [calendar, pendingDep],
  )

  const openAddModal = () =>
    setModalState({ isOpen: true, mode: 'add', initialData: emptyFormData })

  const openEditModal = useCallback((event: Event<Resource>) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      eventId: event.id,
      initialData: {
        title: event.title,
        startDate: toPlainDateString(event.start),
        startTime: toPlainTimeString(event.start),
        endDate: toPlainDateString(event.end),
        endTime: toPlainTimeString(event.end),
        resourceId: event.resources?.[0]?.id ?? sampleResources[0]!.id,
        consumption: event.consumption?.[0] ?? 1,
        dependsOn: event.dependsOn ?? [],
      },
    })
  }, [])

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (data: EventFormData) => {
    setIsSaving(true)
    try {
      const start = `${data.startDate}T${data.startTime}:00`
      const end = `${data.endDate}T${data.endTime}:00`

      const resource = sampleResources.find((r) => r.id === data.resourceId)
      const resources = resource ? [resource] : []

      const result =
        modalState.mode === 'edit' && modalState.eventId
          ? await calendar.editEvent(
              modalState.eventId,
              {
                title: data.title,
                start,
                end,
                resources,
                consumption: [data.consumption],
                dependsOn: data.dependsOn,
              },
              { dependsOn: data.dependsOn },
            )
          : await calendar.addEvent(
              {
                id: String(Date.now()),
                title: data.title,
                start,
                end,
                resources,
                consumption: [data.consumption],
                dependsOn: data.dependsOn,
              },
              { dependsOn: data.dependsOn },
            )

      if (!result.success) {
        setResizeError(result.error)
        throw new Error('Validation failed')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (modalState.eventId) calendar.removeEvent(modalState.eventId)
  }

  const [activeDragEvent, setActiveDragEvent] =
    useState<ActiveDragEventData | null>(null)

  const handleDragStart = (e: any) => {
    setActiveDragEvent(e.operation?.source?.data)
  }

  const handleDragEnd = async (e: any) => {
    setActiveDragEvent(null)
    const sourceData = e.operation?.source?.data
    const targetData = e.operation?.target?.data

    if (!sourceData || !sourceData.event) return

    const draggedEvent = sourceData.event
    const newResource = targetData?.resource || draggedEvent.resources?.[0]

    const deltaX =
      e.operation?.transform?.x ??
      e.operation?.position?.delta?.x ??
      e.delta?.x ??
      0

    if (deltaX !== 0 || targetData?.resource) {
      const containerW = containerWidthRef.current || 1
      const totalHours = calendar.days.length * 24
      const hoursShift = (deltaX / containerW) * totalHours

      const snapShift = Math.round(hoursShift / 0.25) * 0.25
      const msShift = snapShift * 3600 * 1000

      const resourceChanged =
        targetData?.resource &&
        targetData.resource.id !== draggedEvent.resources?.[0]?.id

      if (snapShift === 0 && !resourceChanged) return

      const newStart = new Date(
        new Date(draggedEvent.start).getTime() + msShift,
      )
      const newEnd = new Date(new Date(draggedEvent.end).getTime() + msShift)

      const nextStart = `${toPlainDateString(newStart)}T${toPlainTimeString(newStart)}:00`
      const nextEnd = `${toPlainDateString(newEnd)}T${toPlainTimeString(newEnd)}:00`

      const validation = calendar.validateMove(
        draggedEvent.id,
        nextStart,
        nextEnd,
        newResource ? [newResource] : [],
      )

      if (validation.blocked) {
        getTimeClient().emit('event:update:error', {
          eventId: draggedEvent.id,
          eventTitle: draggedEvent.title,
          reason: 'unavailable-time',
          message:
            validation.message ?? 'This move is blocked by availability.',
          originalStart: draggedEvent.start,
          originalEnd: draggedEvent.end,
          attemptedStart: nextStart,
          attemptedEnd: nextEnd,
        })

        setResizeError({
          eventId: draggedEvent.id,
          eventTitle: draggedEvent.title,
          reason: 'unavailable-time',
          message:
            validation.message ?? 'This move is blocked by availability.',
          originalStart: draggedEvent.start,
          originalEnd: draggedEvent.end,
        })
        return
      }

      await calendar.editEvent(draggedEvent.id, {
        start: nextStart,
        end: nextEnd,
        resources: newResource ? [newResource] : [],
      })
    }
  }

  const viewModeOptions = [
    { label: 'Week', value: 1, unit: 'week' as const },
    { label: '2 Weeks', value: 2, unit: 'week' as const },
  ]

  const virtualColumns = columnVirtualizer.getVirtualItems()
  const virtualRows = rowVirtualizer.getVirtualItems()
  const rowsTotalHeight = rowVirtualizer.getTotalSize()

  const allEvents = calendar.getEvents()

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="p-5 max-w-[1400px] mx-auto min-h-screen">
        <div className="mb-6">
          <h1 className="m-0 mb-4 text-[28px] font-semibold text-white">
            TanStack Time — Timeline
          </h1>

          <div className="flex gap-3 items-center mb-4 flex-wrap">
            <Button
              variant="outline"
              onClick={calendar.goToPreviousPeriod}
              disabled={!calendar.canGoPreviousPeriod() || calendar.isPending}
            >
              ← Previous
            </Button>
            <Button
              variant="outline"
              onClick={calendar.goToCurrentPeriod}
              disabled={calendar.isPending}
            >
              Today
            </Button>
            <Button
              variant="outline"
              onClick={calendar.goToNextPeriod}
              disabled={!calendar.canGoNextPeriod() || calendar.isPending}
            >
              Next →
            </Button>
            <Button onClick={openAddModal}>+ Add Event</Button>

            <Button
              onClick={calendar.undo}
              disabled={!calendar.canUndo()}
              variant="outline"
              title="Undo"
            >
              ↩ Undo
            </Button>
            <Button
              onClick={calendar.redo}
              disabled={!calendar.canRedo()}
              variant="outline"
              title="Redo"
            >
              ↪ Redo
            </Button>

            <div className="ml-auto flex gap-2">
              {viewModeOptions.map((opt) => {
                const isActive =
                  calendar.viewMode.value === opt.value &&
                  calendar.viewMode.unit === opt.unit
                return (
                  <Button
                    key={opt.label}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      calendar.changeViewMode({
                        value: opt.value,
                        unit: opt.unit,
                      })
                    }
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="text-lg font-medium text-neutral-400">
            {calendar.formatPeriodLabel()}
          </div>
        </div>

        <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
          <div className="flex">
            <div className="w-36 flex-shrink-0 border-r border-neutral-800 bg-neutral-950 z-10">
              <div className="h-10 border-b border-neutral-800/50" />
              <div className="h-8 border-b border-neutral-800 px-3 flex items-end pb-1">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Resources
                </span>
              </div>
              {sampleResources.map((resource, idx) => {
                const zoneColor =
                  RESOURCE_ZONE_COLORS[idx % RESOURCE_ZONE_COLORS.length] ??
                  RESOURCE_ZONE_COLORS[0]
                return (
                  <div
                    key={resource.id}
                    className="h-14 border-b border-neutral-800/50 px-3 flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 flex-shrink-0 rounded-sm bg-[length:6px_6px]"
                      style={{
                        backgroundImage: `repeating-linear-gradient(315deg, ${zoneColor} 0, ${zoneColor} 1px, transparent 0, transparent 50%)`,
                        backgroundColor: zoneColor,
                      }}
                    />
                    <span className="text-sm font-medium text-neutral-300 truncate">
                      {resource.label}
                    </span>
                    {resource.capacity && resource.capacity.length > 0 && (
                      <span
                        className="ml-auto text-[10px] uppercase tracking-wide text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5"
                        title="Total capacity"
                      >
                        cap {resource.capacity.reduce((a, b) => a + b, 0)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            <ScrollArea
              viewportRef={scrollContainerRef}
              viewportClassName="max-h-[600px] [&>div]:!block"
              className="flex-1 min-w-0"
            >
              <div
                ref={timelineContentRef}
                style={{
                  width: totalContentWidthPx,
                  position: 'relative',
                }}
              >
                <div
                  className="sticky top-0 z-30 bg-neutral-950"
                  style={{ width: totalContentWidthPx }}
                >
                  <div
                    className="h-10 border-b border-neutral-800/50 relative"
                    style={{ width: totalContentWidthPx }}
                  >
                    {virtualColumns.map((vc) => {
                      const day = calendar.days[vc.index]
                      const localDate = new Date(
                        day.date.year,
                        day.date.month - 1,
                        day.date.day,
                      )
                      const dayName = localDate.toLocaleDateString(undefined, {
                        weekday: 'short',
                      })
                      const dayNum = day.date.day
                      const monthName = localDate.toLocaleDateString(
                        undefined,
                        { month: 'short' },
                      )
                      return (
                        <div
                          key={day.isoDate}
                          className={`absolute top-0 bottom-0 border-r border-neutral-800/50 flex items-center justify-center gap-1.5 ${
                            day.isToday ? 'bg-neutral-800/30' : ''
                          }`}
                          style={{
                            left: vc.start,
                            width: vc.size,
                          }}
                        >
                          <span className="text-[10px] text-neutral-500 uppercase">
                            {dayName}
                          </span>
                          <span
                            className={`text-sm font-semibold ${
                              day.isToday ? 'text-white' : 'text-neutral-300'
                            }`}
                          >
                            {dayNum}
                          </span>
                          <span className="text-[10px] text-neutral-600">
                            {monthName}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div
                    className="h-8 border-b border-neutral-800 relative"
                    style={{ width: totalContentWidthPx }}
                  >
                    {virtualColumns.map((vc) => {
                      const day = calendar.days[vc.index]
                      return (
                        <div
                          key={day.isoDate + '-hours'}
                          className="absolute top-0 bottom-0 border-r border-neutral-800/50"
                          style={{ left: vc.start, width: vc.size }}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <div
                              key={h}
                              className="absolute top-0 bottom-0 border-r border-neutral-800/20 flex items-end justify-center pb-1"
                              style={{
                                left: `${(h / 24) * 100}%`,
                                width: `${(1 / 24) * 100}%`,
                              }}
                            >
                              <span className="text-[9px] text-neutral-600">
                                {h.toString().padStart(2, '0')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div
                  ref={rowsContainerRef}
                  className="relative"
                  style={{
                    height: rowsTotalHeight,
                    width: totalContentWidthPx,
                  }}
                >
                  {timelineLayout.currentTimePosition !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-500 z-20 pointer-events-none"
                      style={{
                        left: `${timelineLayout.currentTimePosition}%`,
                      }}
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-full" />
                    </div>
                  )}
                  {virtualRows.map((vr) => {
                    const row = timelineLayout.rows[vr.index]
                    return (
                      <HorizontalTimelineRow
                        key={row.resource.id}
                        row={row}
                        days={calendar.days}
                        resourceColorIndex={vr.index}
                        onEventClick={openEditModal}
                        getResizeHandleProps={calendar.getResizeHandleProps}
                        getDayColumnProps={calendar.getDayColumnProps}
                        getUnavailableRanges={calendar.getUnavailableRanges}
                        eventBarRefs={eventBarRefsMap}
                        rowWidthPx={totalContentWidthPx}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: vr.size,
                          transform: `translateY(${vr.start}px)`,
                        }}
                      />
                    )
                  })}
                  <div
                    className="absolute inset-0 z-20 pointer-events-none"
                    style={{ overflow: 'hidden' }}
                  >
                    <TimelineDependencyOverlay
                      timelineLayout={timelineLayout}
                      eventBarRefs={eventBarRefsMap}
                      rowsContainerRef={rowsContainerRef}
                      resizeState={resizeState}
                      activeDragEvent={activeDragEvent}
                      onDependencyCreate={handleDependencyDragged}
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-3 border-l border-border pl-6">
            <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">
              Dependencies:
            </span>
            {ALL_DEP_TYPES.map((type) => {
              const style = DEP_TYPE_STYLES[type]
              return (
                <div
                  key={type}
                  className="flex items-center gap-2"
                  title={style.description}
                >
                  <svg width="28" height="10" className="flex-shrink-0">
                    <line
                      x1="0"
                      y1="5"
                      x2="28"
                      y2="5"
                      stroke={style.color}
                      strokeWidth="2"
                      strokeDasharray={style.strokeDasharray}
                    />
                  </svg>
                  <span
                    className={`${style.badgeBg} text-white text-[10px] font-bold rounded px-1.5 py-0.5`}
                  >
                    {style.label}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {style.description.split(' (')[0]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
          <div className="flex flex-wrap gap-2">
            {allEvents.map((event) => {
              const color = getEventColor(event.id)
              return (
                <Badge
                  key={event.id}
                  variant="outline"
                  className="gap-1.5 font-normal"
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-sm ${color.bg} ${color.border} border`}
                  />
                  <span className="text-muted-foreground">{event.title}</span>
                </Badge>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2 border-l border-border pl-6">
            {sampleResources.map((resource, idx) => {
              const zoneColor =
                RESOURCE_ZONE_COLORS[idx % RESOURCE_ZONE_COLORS.length] ??
                RESOURCE_ZONE_COLORS[0]
              return (
                <Badge
                  key={resource.id}
                  variant="secondary"
                  className="gap-1.5 font-normal"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm bg-[length:6px_6px]"
                    style={{
                      backgroundImage: `repeating-linear-gradient(315deg, ${zoneColor} 0, ${zoneColor} 1px, transparent 0, transparent 50%)`,
                      backgroundColor: zoneColor,
                    }}
                  />
                  <span className="text-muted-foreground">
                    {resource.label} — unavailable
                  </span>
                </Badge>
              )
            })}
          </div>
        </div>

        {calendar.isPending && (
          <div className="fixed top-5 right-5">
            <Badge
              variant="secondary"
              className="px-5 py-3 text-sm font-medium"
            >
              Loading...
            </Badge>
          </div>
        )}

        <EventModal
          isOpen={modalState.isOpen}
          onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
          onSave={handleSave}
          onDelete={modalState.mode === 'edit' ? handleDelete : undefined}
          initialData={modalState.initialData}
          mode={modalState.mode}
          isSaving={isSaving}
          allEvents={allEvents}
          editingEventId={modalState.eventId}
        />

        <DependencyTypeModal
          isOpen={pendingDep !== null}
          sourceTitle={pendingDep?.sourceTitle ?? ''}
          targetTitle={pendingDep?.targetTitle ?? ''}
          onChoose={finalizeDependency}
          onCancel={() => setPendingDep(null)}
        />

        {resizeError && (
          <ResizeErrorToast
            error={resizeError}
            onDismiss={() => setResizeError(null)}
          />
        )}

        {activeDragEvent && (
          <DragOverlay dropAnimation={null}>
            <div
              className={`group absolute border ${activeDragEvent.color.bg} ${activeDragEvent.color.border} ${activeDragEvent.color.text} px-2.5 flex items-center text-xs font-medium overflow-hidden shadow-sm z-[9999] rounded-md`}
              style={{
                width: `${containerWidthRef.current * (activeDragEvent.width / 100)}px`,
                height: `${(activeDragEvent.laneHeightPct / 100) * 56 - EVENT_GAP_PX * 2}px`,
              }}
            >
              <span className="truncate">{activeDragEvent.event.title}</span>
            </div>
          </DragOverlay>
        )}
      </div>
    </DragDropProvider>
  )
}
