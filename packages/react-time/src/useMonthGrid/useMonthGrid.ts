import { useCallback, useMemo } from 'react'
import { useStore } from '@tanstack/react-store'
import { buildDayCellAttributes, buildEventAttributes } from '@tanstack/time'
import { useCalendarContext } from '../CalendarProvider/CalendarProvider'
import type {
  Day,
  DayCellAttributes,
  Event,
  EventAttributes,
  Resource,
} from '@tanstack/time'

export interface MonthDayProps extends DayCellAttributes {
  key: string
  onClick?: () => void
}

export interface MonthEventProps extends EventAttributes {
  key: string
  onClick?: () => void
}

export interface UseMonthGridOptions<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  onDayClick?: (day: Day<TResource, TEvent>) => void
  onEventClick?: (event: TEvent) => void
}

export interface UseMonthGridReturn<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  weeks: Array<Array<Day<TResource, TEvent> | null>>
  dayNames: Array<string>
  getDayProps: (day: Day<TResource, TEvent>) => MonthDayProps
  getEventProps: (event: TEvent) => MonthEventProps
}

/**
 * Month-grid view model: weeks of days plus structural prop-getters for day
 * cells and events. Subscribes to the period + events slice.
 */
export function useMonthGrid<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(
  options: UseMonthGridOptions<TResource, TEvent> = {},
): UseMonthGridReturn<TResource, TEvent> {
  const { core } = useCalendarContext<TResource, TEvent>()
  const { onDayClick, onEventClick } = options

  const snapshot = useStore(core.store, (state) => ({
    currentPeriod: state.currentPeriod.toString(),
    viewMode: state.viewMode,
    eventsVersion: state.eventsVersion,
  }))

  const weeks = useMemo(() => {
    void snapshot
    return core.groupDaysBy({ days: core.getDaysWithEvents(), unit: 'week' })
  }, [core, snapshot])

  const dayNames = useMemo(() => core.getDaysNames(), [core])
  const locale = core.options.locale

  const getDayProps = useCallback(
    (day: Day<TResource, TEvent>): MonthDayProps => ({
      key: day.isoDate,
      ...buildDayCellAttributes(day, { locale }),
      onClick: onDayClick ? () => onDayClick(day) : undefined,
    }),
    [locale, onDayClick],
  )

  const getEventProps = useCallback(
    (event: TEvent): MonthEventProps => ({
      key: event.id,
      ...buildEventAttributes(event),
      onClick: onEventClick ? () => onEventClick(event) : undefined,
    }),
    [onEventClick],
  )

  return { weeks, dayNames, getDayProps, getEventProps }
}
