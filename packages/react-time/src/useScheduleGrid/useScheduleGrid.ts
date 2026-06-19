import { useCallback, useMemo, useRef } from 'react'
import { useStore } from '@tanstack/react-store'
import { buildEventAttributes } from '@tanstack/time'
import { useCalendarContext } from '../CalendarProvider/CalendarProvider'
import {
  createGetDayColumnProps,
  createGetResizeHandleProps,
} from '../useCalendar/resizeProps'
import type {
  DayColumnProps,
  GetDayColumnProps,
  GetResizeHandleProps,
  ResizeHandleHandlers,
} from '../useCalendar/resizeProps'
import type {
  Day,
  Event,
  EventAttributes,
  Resource,
  TimeSlot,
} from '@tanstack/time'

export interface TimeSlotOptions {
  startHour?: number
  endHour?: number
  interval?: number
}

export interface ScheduleEventStyle {
  top: string
  height: string
  left: string
  width: string
}

export interface ScheduleEventProps extends EventAttributes {
  key: string
  style?: ScheduleEventStyle
  onClick?: () => void
}

export interface UseScheduleGridOptions {
  timeSlots?: TimeSlotOptions
  onEventClick?: (eventId: string) => void
}

export interface UseScheduleGridReturn<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  days: Array<Day<TResource, TEvent>>
  timeSlots: Array<TimeSlot>
  getDayColumnProps: GetDayColumnProps
  getResizeHandleProps: GetResizeHandleProps
  getEventProps: (event: TEvent) => ScheduleEventProps
}

/**
 * Time-grid (week/day) view model: days, time slots, positioned events, and the
 * resize/column prop-getters bound to the shared resize controller.
 */
export function useScheduleGrid<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(
  options: UseScheduleGridOptions = {},
): UseScheduleGridReturn<TResource, TEvent> {
  const { core, resizeController } = useCalendarContext<TResource, TEvent>()
  const { onEventClick } = options
  const timeSlotOptions = options.timeSlots

  const snapshot = useStore(core.store, (state) => ({
    currentPeriod: state.currentPeriod.toString(),
    activeDate: state.activeDate.toString(),
    viewMode: state.viewMode,
    eventsVersion: state.eventsVersion,
  }))

  const days = useMemo(() => {
    void snapshot
    return core.getDaysWithEvents()
  }, [core, snapshot])

  const timeSlots = useMemo(
    () => core.getTimeSlots(timeSlotOptions),
    [core, timeSlotOptions],
  )

  const resizeHandleCacheRef = useRef(new Map<string, ResizeHandleHandlers>())
  const dayColumnCacheRef = useRef(new Map<string, DayColumnProps>())

  const getResizeHandleProps = useMemo(
    () =>
      createGetResizeHandleProps(resizeController, resizeHandleCacheRef.current),
    [resizeController],
  )

  const getDayColumnProps = useMemo(
    () => createGetDayColumnProps(resizeController, dayColumnCacheRef.current),
    [resizeController],
  )

  const getEventProps = useCallback(
    (event: TEvent): ScheduleEventProps => {
      const layout = core.getEventProps(event)
      return {
        key: event.id,
        ...buildEventAttributes(event),
        style: layout.style,
        onClick: onEventClick ? () => onEventClick(event.id) : undefined,
      }
    },
    [core, onEventClick],
  )

  return {
    days,
    timeSlots,
    getDayColumnProps,
    getResizeHandleProps,
    getEventProps,
  }
}
