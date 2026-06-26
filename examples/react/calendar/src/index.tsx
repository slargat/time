import { useCalendar } from '@tanstack/react-time'
import ReactDOM from 'react-dom/client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { timeDevtoolsPlugin } from '@tanstack/react-time-devtools'
import { useInfiniteScroll } from './lib/useInfiniteScroll'
import { calendarFeatures } from './lib/calendar'
import { formatDateToISO } from './lib/dates'
import { MOCK_DB, getResourceId, sampleResources } from './lib/sampleData'
import { emptyFormData } from './lib/eventForm'
import { EventModal } from './components/EventModal'
import { ScheduleView } from './components/ScheduleView'
import { ResizeErrorToast } from './components/ResizeErrorToast'
import { ScopeChoiceModal } from './components/ScopeChoiceModal'
import { EventContextMenuItems } from './components/EventContextMenu'
import type { EventFormData } from './lib/eventForm'
import type { CalendarDay } from './lib/calendar'
import type {
  Event,
  EventDateTimeInput,
  RecurrenceEditScope,
  RecurrenceRule,
  ResizeError,
  Resource,
} from '@tanstack/time'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import './index.css'

type ModalState = {
  isOpen: boolean
  mode: 'add' | 'edit'
  eventId?: string
  occurrenceStart?: string
  isRecurring?: boolean
  initialData: EventFormData
}
function CalendarView() {
  const [resources, setResources] = useState<Array<Resource>>(sampleResources)

  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    mode: 'add',
    initialData: emptyFormData,
  })

  const [scopeChoiceEvent, setScopeChoiceEvent] =
    useState<Event<Resource> | null>(null)
  const [resizeScopeChoice, setResizeScopeChoice] = useState<{
    eventId: string
    occurrenceStart: EventDateTimeInput
    newStart: string
    newEnd: string
  } | null>(null)

  const [resizeError, setResizeError] = useState<ResizeError | null>(null)

  const calendar = useCalendar(
    {
      viewMode: { value: 1, unit: 'month' },
      events: [] as Array<Event<Resource>>,
      resources,
      timeZone: 'UTC',
      features: calendarFeatures,
      fetchEvents: async ({ start, end }) => {
        await new Promise((resolve) => setTimeout(resolve, 300))

        const startDate = new Date(start)
        const endDate = new Date(end)
        const resourceById = new Map(
          resources.map((resource) => [resource.id, resource]),
        )

        return MOCK_DB.filter((e) => {
          if (e.recurrence) return true
          const eStart = new Date(e.start as string)
          const eEnd = new Date(e.end as string)
          return eStart <= endDate && eEnd >= startDate
        }).map((event) => ({
          ...event,
          resources:
            event.resources
              ?.map((resource) => resourceById.get(getResourceId(resource)))
              .filter((resource): resource is Resource => resource != null) ??
            [],
        }))
      },
      resize: {
        enabled: true,
        containerHeight: 1440,
        constraints: {
          minDurationMinutes: 15,
          snapToMinutes: 15,
        },
        onResizeError: (error) => {
          setResizeError(error)
        },
        onRecurringResizeEnd: (resize) => {
          setResizeScopeChoice({
            eventId: resize.eventId,
            occurrenceStart: resize.occurrenceStart,
            newStart: resize.newStart,
            newEnd: resize.newEnd,
          })
        },
      },
    },
    (state) => state,
  )

  // `calendar.state` is the subscribed state (whole state here — no selector
  // was passed to useCalendar). For finer control, pass a selector to
  // useCalendar, use <calendar.Subscribe> lower in the tree, or read
  // useStore(calendar.store, selector) directly. `days` is memoized off the
  // relevant state slices so its identity is stable (getDays() builds fresh).
  const state = calendar.state
  const viewMode = state.viewMode
  const currentPeriod = state.currentPeriod.toString({ calendarName: 'never' })
  const isPending = state.isPending
  // calendar identity churns with state; depend on the slices that affect days.
  const days = useMemo(
    () => calendar.getDays(),
    [state.currentPeriod, state.viewMode, state.eventsVersion],
  )

  const dayNames = calendar.getDaysNames('short')

  const isScheduleView = viewMode.unit === 'week' || viewMode.unit === 'day'
  const scheduleDays: Array<CalendarDay> = isScheduleView
    ? viewMode.unit === 'day'
      ? days.filter((day) => {
          const currentDateStr = currentPeriod.split('[')[0]
          return day.date.toString({ calendarName: 'never' }) === currentDateStr
        })
      : days
    : []

  const monthScrollRef = useRef<HTMLDivElement>(null)
  const monthBufferRef = useRef<{ start: string; end: string } | null>(null)
  if (monthBufferRef.current === null && days.length > 0) {
    monthBufferRef.current = {
      start: days[0].isoDate,
      end: days[days.length - 1].isoDate,
    }
  }

  const navDirectionRef = useRef<'none' | 'forward' | 'backward'>('none')
  const prevPeriodRef = useRef(currentPeriod)
  const prevScrollHeightRef = useRef(0)
  const needsScrollAdjRef = useRef(false)
  const [bufferVersion, setBufferVersion] = useState(0)

  const [visibleMonth, setVisibleMonth] = useState(() =>
    calendar.formatCurrentPeriod(),
  )
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    setVisibleMonth(calendar.formatCurrentPeriod())
  }, [currentPeriod])

  useEffect(() => {
    const el = monthScrollRef.current
    if (!el) return

    const compute = () => {
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = undefined
        const viewportRect = el.getBoundingClientRect()
        const cells = el.querySelectorAll<HTMLElement>('[data-day-date]')
        for (const cell of cells) {
          const cellRect = cell.getBoundingClientRect()
          if (cellRect.bottom > viewportRect.top) {
            const iso = cell.getAttribute('data-day-date')
            if (iso) {
              const d = new Date(`${iso}T00:00:00`)
              setVisibleMonth(
                d.toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                }),
              )
            }
            break
          }
        }
      })
    }

    el.addEventListener('scroll', compute, { passive: true })
    compute()
    return () => el.removeEventListener('scroll', compute)
  }, [bufferVersion])

  useEffect(() => {
    if (navDirectionRef.current === 'none') return
    if (currentPeriod === prevPeriodRef.current) return
    prevPeriodRef.current = currentPeriod

    const direction = navDirectionRef.current
    navDirectionRef.current = 'none'

    if (days.length === 0 || !monthBufferRef.current) return
    const newStart = days[0].isoDate
    const newEnd = days[days.length - 1].isoDate
    monthBufferRef.current = {
      start:
        newStart < monthBufferRef.current.start
          ? newStart
          : monthBufferRef.current.start,
      end:
        newEnd > monthBufferRef.current.end
          ? newEnd
          : monthBufferRef.current.end,
    }

    if (direction === 'backward') {
      prevScrollHeightRef.current = monthScrollRef.current?.scrollHeight ?? 0
      needsScrollAdjRef.current = true
    }

    setBufferVersion((v) => v + 1)
  }, [currentPeriod, days])

  useLayoutEffect(() => {
    if (!needsScrollAdjRef.current) return
    needsScrollAdjRef.current = false
    const el = monthScrollRef.current
    if (el) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current
    }
  })

  const bufferedWeekGroups = useMemo(() => {
    void bufferVersion
    void days
    if (!monthBufferRef.current) return []
    const rangeDays = calendar.getDaysInRange(
      monthBufferRef.current.start,
      monthBufferRef.current.end,
    )
    return calendar.groupDaysBy({
      days: rangeDays,
      unit: 'week',
      fillMissingDays: true,
    })
  }, [bufferVersion, days, calendar])

  const { startSentinelRef: monthTopRef, endSentinelRef: monthBottomRef } =
    useInfiniteScroll({
      root: monthScrollRef,
      rootMargin: '120px 0px',
      cooldownMs: 1000,
      onReachStart: () => {
        const el = monthScrollRef.current
        if (!el || el.scrollHeight <= el.clientHeight) return
        if (!calendar.canGoPreviousPeriod() || isPending) return
        navDirectionRef.current = 'backward'
        calendar.goToPreviousPeriod()
      },
      onReachEnd: () => {
        if (!calendar.canGoNextPeriod() || isPending) return
        navDirectionRef.current = 'forward'
        calendar.goToNextPeriod()
      },
      disabled: isScheduleView,
    })

  const scheduleScrollRef = useRef<HTMLDivElement>(null)
  const scheduleBufferRef = useRef<{ start: string; end: string } | null>(null)
  const scheduleNavDirectionRef = useRef<'none' | 'forward' | 'backward'>(
    'none',
  )
  const prevSchedulePeriodRef = useRef(currentPeriod)
  const prevScheduleScrollWidthRef = useRef(0)
  const needsScheduleScrollAdjRef = useRef(false)
  const [scheduleBufferVersion, setScheduleBufferVersion] = useState(0)
  const prevViewModeUnitRef = useRef(viewMode.unit)

  if (prevViewModeUnitRef.current !== viewMode.unit) {
    prevViewModeUnitRef.current = viewMode.unit
    scheduleBufferRef.current = null
    prevSchedulePeriodRef.current = currentPeriod
    monthBufferRef.current =
      days.length > 0
        ? {
            start: days[0].isoDate,
            end: days[days.length - 1].isoDate,
          }
        : null
  }

  if (
    isScheduleView &&
    scheduleBufferRef.current === null &&
    scheduleDays.length > 0
  ) {
    scheduleBufferRef.current = {
      start: scheduleDays[0].isoDate,
      end: scheduleDays[scheduleDays.length - 1].isoDate,
    }
  }

  useEffect(() => {
    if (!isScheduleView) return
    if (currentPeriod === prevSchedulePeriodRef.current) return
    prevSchedulePeriodRef.current = currentPeriod

    let currentDays: typeof days
    if (viewMode.unit === 'day') {
      const currentDateStr = currentPeriod.split('[')[0]
      currentDays = days.filter(
        (day) =>
          day.date.toString({ calendarName: 'never' }) === currentDateStr,
      )
    } else {
      currentDays = days
    }

    if (currentDays.length === 0) return
    const newStart = currentDays[0].isoDate
    const newEnd = currentDays[currentDays.length - 1].isoDate

    if (scheduleNavDirectionRef.current === 'none') {
      scheduleBufferRef.current = { start: newStart, end: newEnd }
    } else {
      const direction = scheduleNavDirectionRef.current
      scheduleNavDirectionRef.current = 'none'
      const prev = scheduleBufferRef.current ?? {
        start: newStart,
        end: newEnd,
      }
      scheduleBufferRef.current = {
        start: newStart < prev.start ? newStart : prev.start,
        end: newEnd > prev.end ? newEnd : prev.end,
      }
      if (direction === 'backward') {
        prevScheduleScrollWidthRef.current =
          scheduleScrollRef.current?.scrollWidth ?? 0
        needsScheduleScrollAdjRef.current = true
      }
    }

    setScheduleBufferVersion((v) => v + 1)
  }, [currentPeriod, isScheduleView, viewMode.unit, days])

  useLayoutEffect(() => {
    if (!needsScheduleScrollAdjRef.current) return
    needsScheduleScrollAdjRef.current = false
    const el = scheduleScrollRef.current
    if (el) {
      el.scrollLeft += el.scrollWidth - prevScheduleScrollWidthRef.current
    }
  })

  const bufferedScheduleDays = useMemo(() => {
    void scheduleBufferVersion
    void days
    if (!scheduleBufferRef.current) return scheduleDays
    return calendar.getDaysInRange(
      scheduleBufferRef.current.start,
      scheduleBufferRef.current.end,
    )
  }, [scheduleBufferVersion, scheduleDays, days, calendar])

  const periodDayCount = viewMode.unit === 'day' ? 1 : scheduleDays.length || 7

  const {
    startSentinelRef: scheduleLeftRef,
    endSentinelRef: scheduleRightRef,
  } = useInfiniteScroll({
    root: scheduleScrollRef,
    rootMargin: '0px 50%',
    cooldownMs: 300,
    onReachStart: () => {
      const el = scheduleScrollRef.current
      if (!el || el.scrollWidth <= el.clientWidth) return
      if (!calendar.canGoPreviousPeriod() || isPending) return
      scheduleNavDirectionRef.current = 'backward'
      calendar.goToPreviousPeriod()
    },
    onReachEnd: () => {
      if (!calendar.canGoNextPeriod() || isPending) return
      scheduleNavDirectionRef.current = 'forward'
      calendar.goToNextPeriod()
    },
    disabled: !isScheduleView,
  })

  function openAddModal() {
    setModalState({
      isOpen: true,
      mode: 'add',
      initialData: {
        ...emptyFormData,
        resourceId: resources[0]?.id ?? '',
      },
    })
  }

  function handleEventClick(
    event: Event<Resource>,
    scope?: RecurrenceEditScope,
  ) {
    if (event.recurrence && !scope) {
      setScopeChoiceEvent(event)
      return
    }
    openEditModal(event, scope)
  }

  const openEditModal = (
    event: Event<Resource>,
    scope: RecurrenceEditScope = event.recurrence ? 'this' : 'all',
  ) => {
    const masterEvent = calendar.getMasterEvent(event)
    const segmentInfo = calendar.getEventSegmentInfo(event)
    const startDate = new Date(segmentInfo.originalStart)
    const endDate = new Date(segmentInfo.originalEnd)
    const rule = masterEvent.recurrence
    const isRecurring = !!rule
    const eventResource = event.resources?.[0] ?? masterEvent.resources?.[0]
    const eventResourceId = eventResource ? getResourceId(eventResource) : ''

    setModalState({
      isOpen: true,
      mode: 'edit',
      eventId: isRecurring ? event.id : masterEvent.id,
      occurrenceStart: isRecurring
        ? (event._occurrenceOriginalStart ?? segmentInfo.originalStart)
        : undefined,
      isRecurring,
      initialData: {
        title: event.title,
        startDate: formatDateToISO(startDate),
        startTime: startDate.toTimeString().slice(0, 5),
        endDate: formatDateToISO(endDate),
        endTime: endDate.toTimeString().slice(0, 5),
        resourceId: eventResourceId || resources[0]?.id || '',
        consumption:
          event.consumption?.[0] ?? masterEvent.consumption?.[0] ?? 1,
        recurrenceFrequency: rule?.frequency ?? 'none',
        recurrenceUntil: rule?.until ?? '',
        recurrenceEditScope: scope,
        allDay: !!event.allDay,
      },
    })
  }

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
  }

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (data: EventFormData) => {
    setIsSaving(true)
    try {
      const recurrence: RecurrenceRule | undefined =
        data.recurrenceFrequency !== 'none'
          ? {
              frequency: data.recurrenceFrequency,
              ...(data.recurrenceUntil ? { until: data.recurrenceUntil } : {}),
            }
          : undefined

      const start = data.allDay
        ? `${data.startDate}T00:00:00`
        : `${data.startDate}T${data.startTime}:00`
      const end = data.allDay
        ? `${data.endDate}T23:59:59`
        : `${data.endDate}T${data.endTime}:00`
      const selectedResource = resources.find((r) => r.id === data.resourceId)
      const eventResources =
        data.allDay || !selectedResource ? [] : [selectedResource]
      const eventConsumption = data.allDay ? [] : [data.consumption]

      const updates: Partial<Omit<Event<Resource>, 'id'>> = {
        title: data.title,
        start,
        end,
        ...(modalState.isRecurring && data.recurrenceEditScope === 'this'
          ? {}
          : { recurrence }),
        resources: eventResources,
        consumption: eventConsumption,
        allDay: data.allDay,
      }

      const result =
        modalState.mode === 'edit' && modalState.eventId
          ? modalState.isRecurring
            ? await calendar.editRecurringEvent(modalState.eventId, updates, {
                scope: data.recurrenceEditScope,
                occurrenceStart: modalState.occurrenceStart,
              })
            : await calendar.editEvent(modalState.eventId, updates)
          : await calendar.addEvent({
              id: String(Date.now()),
              title: data.title,
              start,
              end,
              recurrence,
              resources: eventResources,
              consumption: eventConsumption,
              allDay: data.allDay,
            })
      if (!result.success) {
        setResizeError(result.error)
        throw new Error('Validation failed')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (data: EventFormData) => {
    if (!modalState.eventId) return

    if (modalState.isRecurring) {
      calendar.removeRecurringEvent(modalState.eventId, {
        scope: data.recurrenceEditScope,
        occurrenceStart: modalState.occurrenceStart,
      })
      return
    }

    calendar.removeEvent(modalState.eventId)
  }

  return (
    <div className="p-5 max-w-[1200px] mx-auto min-h-screen">
      <div className="mb-6">
        <h1 className="m-0 mb-4 text-[28px] font-semibold text-white">
          TanStack Time
        </h1>

        <div className="flex gap-3 items-center mb-4 flex-wrap">
          <Button
            onClick={calendar.goToPreviousPeriod}
            disabled={!calendar.canGoPreviousPeriod() || isPending}
            variant="outline"
          >
            ← Previous
          </Button>

          <Button
            onClick={calendar.goToCurrentPeriod}
            disabled={isPending}
            variant="outline"
          >
            Today
          </Button>

          <Button
            onClick={calendar.goToNextPeriod}
            disabled={!calendar.canGoNextPeriod() || isPending}
            variant="outline"
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
            <Button
              onClick={() =>
                calendar.changeViewMode({ value: 1, unit: 'month' })
              }
              variant={viewMode.unit === 'month' ? 'secondary' : 'outline'}
              size="sm"
            >
              Month
            </Button>
            <Button
              onClick={() =>
                calendar.changeViewMode({ value: 1, unit: 'week' })
              }
              variant={viewMode.unit === 'week' ? 'secondary' : 'outline'}
              size="sm"
            >
              Week
            </Button>
            <Button
              onClick={() => calendar.changeViewMode({ value: 1, unit: 'day' })}
              variant={viewMode.unit === 'day' ? 'secondary' : 'outline'}
              size="sm"
            >
              Day
            </Button>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
            Capacity Controls
          </div>
          <div className="flex flex-wrap gap-3">
            {resources.map((resource) => {
              const currentCapacity = resource.capacity?.[0] ?? 1
              return (
                <div
                  key={resource.id}
                  className="flex items-center gap-2 rounded-md border border-neutral-800 bg-black px-3 py-2"
                >
                  <span className="text-sm text-neutral-300">
                    {resource.label}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={currentCapacity}
                    onChange={(e) => {
                      const nextCapacity = Math.max(
                        1,
                        Number(e.target.value) || 1,
                      )
                      setResources((prev) =>
                        prev.map((r) =>
                          r.id === resource.id
                            ? { ...r, capacity: [nextCapacity] }
                            : r,
                        ),
                      )
                    }}
                    className="h-8 w-24"
                  />
                </div>
              )
            })}
          </div>
        </div>

        <div className="text-lg font-medium text-neutral-400">
          {visibleMonth}
        </div>
      </div>

      {isScheduleView ? (
        <ScheduleView
          calendar={calendar}
          days={bufferedScheduleDays}
          resources={resources}
          onEventClick={handleEventClick}
          scrollRef={scheduleScrollRef}
          leftSentinelRef={scheduleLeftRef}
          rightSentinelRef={scheduleRightRef}
          periodDayCount={periodDayCount}
        />
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black">
          {/* Sticky day-name header */}
          <div
            className="grid border-b border-neutral-800 bg-neutral-950 sticky top-0 z-10"
            style={{
              gridTemplateColumns: `repeat(${dayNames.length}, minmax(0, 1fr))`,
            }}
          >
            {dayNames.map((dayName: string, index: number) => (
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
          <ScrollArea
            viewportRef={monthScrollRef}
            className="h-[calc(100vh-260px)]"
          >
            {/* Top sentinel: triggers goToPreviousPeriod */}
            <div ref={monthTopRef} style={{ height: 1 }} aria-hidden />

            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${dayNames.length}, minmax(0, 1fr))`,
              }}
            >
              {(bufferedWeekGroups as Array<Array<CalendarDay | null>>).map(
                (week, weekIndex: number) => {
                  const weekKey =
                    week.find((d) => d !== null)?.isoDate ?? `w-${weekIndex}`
                  return week.map((day, dayIndex) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${weekKey}-${dayIndex}`}
                          className={`min-h-[120px] bg-neutral-950/50 ${
                            dayIndex < dayNames.length - 1
                              ? 'border-r border-neutral-800'
                              : ''
                          } border-b border-neutral-800`}
                        />
                      )
                    }

                    const isToday = day.isToday
                    const isInCurrentPeriod = day.isInCurrentPeriod

                    return (
                      <div
                        key={day.isoDate}
                        data-day-date={day.isoDate}
                        className={`min-h-[120px] p-2 relative flex flex-col ${
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
                        <div className="flex flex-col gap-1 flex-1 min-h-0">
                          {day.allDayEvents.map((event) => (
                            <Badge
                              key={`ad-${event.id}`}
                              className="cursor-pointer bg-amber-700/70 hover:bg-amber-600/80 text-amber-50 border border-amber-600/40 flex items-center gap-1.5 max-w-full flex-shrink-0 w-full"
                              title={event.title}
                              onClick={() => handleEventClick(event)}
                            >
                              <span className="truncate">{event.title}</span>
                            </Badge>
                          ))}
                          {day.events.map((event) => (
                            <ContextMenu key={event.id}>
                              <ContextMenuTrigger className="contents">
                                <Badge
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-muted flex items-center gap-1.5 max-w-full flex-shrink-0 w-full"
                                  title={event.title}
                                  onClick={() => handleEventClick(event)}
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
                                </Badge>
                              </ContextMenuTrigger>
                              <EventContextMenuItems
                                event={event}
                                calendar={calendar}
                                onEdit={openEditModal}
                              />
                            </ContextMenu>
                          ))}
                        </div>
                      </div>
                    )
                  })
                },
              )}
            </div>

            {/* Bottom sentinel: triggers goToNextPeriod */}
            <div ref={monthBottomRef} style={{ height: 1 }} aria-hidden />
          </ScrollArea>
        </div>
      )}

      {/* Targeted subscription: this only re-renders when `isPending` flips. */}
      <calendar.Subscribe selector={(s) => s.isPending}>
        {(pending) =>
          pending ? (
            <div className="fixed top-5 right-5 px-5 py-3 bg-card border border-border text-foreground rounded-md text-sm font-medium">
              Loading...
            </div>
          ) : null
        }
      </calendar.Subscribe>

      <ScopeChoiceModal
        event={scopeChoiceEvent}
        isOpen={!!scopeChoiceEvent}
        onSelect={(scope) => {
          if (scopeChoiceEvent) {
            openEditModal(scopeChoiceEvent, scope)
          }
          setScopeChoiceEvent(null)
        }}
        onClose={() => setScopeChoiceEvent(null)}
      />

      <ScopeChoiceModal
        event={null}
        title="Resize recurring event"
        isOpen={!!resizeScopeChoice}
        onSelect={(scope) => {
          const pending = resizeScopeChoice
          setResizeScopeChoice(null)
          if (!pending) return
          void calendar
            .editRecurringEvent(
              pending.eventId,
              { start: pending.newStart, end: pending.newEnd },
              { scope, occurrenceStart: pending.occurrenceStart },
            )
            .then((result) => {
              if (!result.success) setResizeError(result.error)
            })
        }}
        onClose={() => setResizeScopeChoice(null)}
      />

      <EventModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={modalState.mode === 'edit' ? handleDelete : undefined}
        initialData={modalState.initialData}
        mode={modalState.mode}
        isRecurring={modalState.isRecurring}
        isSaving={isSaving}
        resources={resources}
      />

      {resizeError && (
        <ResizeErrorToast
          error={resizeError}
          onDismiss={() => setResizeError(null)}
        />
      )}
    </div>
  )
}

function App() {
  return (
    <>
      <TanStackDevtools plugins={[timeDevtoolsPlugin()]} />
      <CalendarView />
    </>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
