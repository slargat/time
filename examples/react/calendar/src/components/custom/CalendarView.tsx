import { useState } from 'react'
import { CalendarProvider, useCalendar } from '@tanstack/react-time'
import type {
  Day,
  Event,
  RecurrenceRule,
  ResizeError,
  Resource,
} from '@tanstack/time'
import type { EventFormData } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EventModal } from '@/components/custom/EventModal'
import { MonthView } from '@/components/custom/MonthView'
import { ScheduleView } from '@/components/custom/ScheduleView'
import { ResizeErrorToast } from '@/components/custom/ResizeErrorToast'
import { useMonthBuffer } from '@/hooks/useMonthBuffer'
import { useScheduleBuffer } from '@/hooks/useScheduleBuffer'
import { MOCK_DB, sampleResources } from '@/data/samples'
import { formatDateToISO } from '@/lib/dates'
import { emptyFormData } from '@/types'

export function CalendarView() {
  const [resources, setResources] = useState<Array<Resource>>(sampleResources)

  const [modalState, setModalState] = useState<{
    isOpen: boolean
    mode: 'add' | 'edit'
    eventId?: string
    initialData: EventFormData
  }>({
    isOpen: false,
    mode: 'add',
    initialData: emptyFormData,
  })

  const [resizeError, setResizeError] = useState<ResizeError | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const calendar = useCalendar<Resource, Event<Resource>>({
    viewMode: { value: 1, unit: 'month' },
    events: [],
    resources,
    timeZone: 'UTC',
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
            ?.map((resource) =>
              resourceById.get(
                typeof resource === 'string' ? resource : resource.id,
              ),
            )
            .filter((resource): resource is Resource => resource != null) ?? [],
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
    },
  })

  const isScheduleView =
    calendar.viewMode.unit === 'week' || calendar.viewMode.unit === 'day'
  const scheduleDays: Array<Day<Resource, Event<Resource>>> = isScheduleView
    ? calendar.viewMode.unit === 'day'
      ? calendar.days.filter((day) => {
          const currentDateStr = calendar.currentPeriod.split('[')[0]
          return day.date.toString({ calendarName: 'never' }) === currentDateStr
        })
      : calendar.days
    : []

  const {
    scrollRef: monthScrollRef,
    topSentinelRef: monthTopRef,
    bottomSentinelRef: monthBottomRef,
    weekGroups: bufferedWeekGroups,
  } = useMonthBuffer({ calendar, isScheduleView })

  const {
    scrollRef: scheduleScrollRef,
    leftSentinelRef: scheduleLeftRef,
    rightSentinelRef: scheduleRightRef,
    bufferedScheduleDays,
    periodDayCount,
  } = useScheduleBuffer({ calendar, isScheduleView, scheduleDays })

  const openAddModal = () => {
    setModalState({
      isOpen: true,
      mode: 'add',
      initialData: {
        ...emptyFormData,
        resourceId: resources[0]?.id ?? '',
      },
    })
  }

  const openEditModal = (event: Event<Resource>) => {
    const masterEvent = calendar.getMasterEvent(event)
    const eventProps = calendar.getEventProps(masterEvent)
    const startDate = new Date(eventProps.start)
    const endDate = new Date(eventProps.end)

    const rule = masterEvent.recurrence

    setModalState({
      isOpen: true,
      mode: 'edit',
      eventId: masterEvent.id,
      initialData: {
        title: masterEvent.title,
        startDate: formatDateToISO(startDate),
        startTime: startDate.toTimeString().slice(0, 5),
        endDate: formatDateToISO(endDate),
        endTime: endDate.toTimeString().slice(0, 5),
        resourceId:
          typeof masterEvent.resources === 'string'
            ? masterEvent.resources
            : (masterEvent.resources?.[0]?.toString() ??
              (resources[0]?.id || '')),
        consumption: masterEvent.consumption?.[0] ?? 1,
        recurrenceFrequency: rule?.frequency ?? 'none',
        recurrenceUntil: rule?.until ?? '',
      },
    })
  }

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }))
  }

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

      const start = `${data.startDate}T${data.startTime}:00`
      const end = `${data.endDate}T${data.endTime}:00`
      const selectedResource = resources.find((r) => r.id === data.resourceId)
      const eventResources = selectedResource ? [selectedResource] : []

      const result =
        modalState.mode === 'edit' && modalState.eventId
          ? await calendar.editEvent(modalState.eventId, {
              title: data.title,
              start,
              end,
              recurrence,
              resources: eventResources,
              consumption: [data.consumption],
            })
          : await calendar.addEvent({
              id: String(Date.now()),
              title: data.title,
              start,
              end,
              recurrence,
              resources: eventResources,
              consumption: [data.consumption],
            })

      if (!result.success) {
        setResizeError(result.error)
        throw new Error('Validation failed')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = () => {
    if (modalState.eventId) {
      calendar.removeEvent(modalState.eventId)
    }
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
            disabled={!calendar.canGoPreviousPeriod() || calendar.isPending}
            variant="outline"
          >
            ← Previous
          </Button>

          <Button
            onClick={calendar.goToCurrentPeriod}
            disabled={calendar.isPending}
            variant="outline"
          >
            Today
          </Button>

          <Button
            onClick={calendar.goToNextPeriod}
            disabled={!calendar.canGoNextPeriod() || calendar.isPending}
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
              variant={
                calendar.viewMode.unit === 'month' ? 'secondary' : 'outline'
              }
              size="sm"
            >
              Month
            </Button>
            <Button
              onClick={() =>
                calendar.changeViewMode({ value: 1, unit: 'week' })
              }
              variant={
                calendar.viewMode.unit === 'week' ? 'secondary' : 'outline'
              }
              size="sm"
            >
              Week
            </Button>
            <Button
              onClick={() => calendar.changeViewMode({ value: 1, unit: 'day' })}
              variant={
                calendar.viewMode.unit === 'day' ? 'secondary' : 'outline'
              }
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
          {calendar.formatCurrentPeriod()}
        </div>
      </div>

      <CalendarProvider value={calendar}>
        {isScheduleView ? (
          <ScheduleView
            calendar={calendar}
            days={bufferedScheduleDays}
            resources={resources}
            onEventClick={openEditModal}
            scrollRef={scheduleScrollRef}
            leftSentinelRef={scheduleLeftRef}
            rightSentinelRef={scheduleRightRef}
            periodDayCount={periodDayCount}
          />
        ) : (
          <MonthView
            weekGroups={bufferedWeekGroups}
            scrollRef={monthScrollRef}
            topSentinelRef={monthTopRef}
            bottomSentinelRef={monthBottomRef}
            onEventClick={openEditModal}
          />
        )}
      </CalendarProvider>

      {calendar.isPending && (
        <div className="fixed top-5 right-5 px-5 py-3 bg-card border border-border text-foreground rounded-md text-sm font-medium">
          Loading...
        </div>
      )}

      <EventModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={modalState.mode === 'edit' ? handleDelete : undefined}
        initialData={modalState.initialData}
        mode={modalState.mode}
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
