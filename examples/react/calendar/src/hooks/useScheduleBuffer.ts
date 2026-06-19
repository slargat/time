import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { useCalendar } from '@tanstack/react-time'
import type { Day, Event, Resource } from '@tanstack/time'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

interface UseScheduleBufferArgs {
  calendar: ReturnType<typeof useCalendar<Resource, Event<Resource>>>
  isScheduleView: boolean
  scheduleDays: Array<Day<Resource, Event<Resource>>>
}

interface UseScheduleBufferResult {
  scrollRef: React.RefObject<HTMLDivElement | null>
  leftSentinelRef: React.RefObject<HTMLDivElement | null>
  rightSentinelRef: React.RefObject<HTMLDivElement | null>
  bufferedScheduleDays: Array<Day<Resource, Event<Resource>>>
  periodDayCount: number
}

export function useScheduleBuffer({
  calendar,
  isScheduleView,
  scheduleDays,
}: UseScheduleBufferArgs): UseScheduleBufferResult {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bufferRef = useRef<{ start: string; end: string } | null>(null)
  const navDirectionRef = useRef<'none' | 'forward' | 'backward'>('none')
  const prevPeriodRef = useRef(calendar.currentPeriod)
  const prevScrollWidthRef = useRef(0)
  const needsScrollAdjRef = useRef(false)
  const prevViewModeUnitRef = useRef(calendar.viewMode.unit)
  const [bufferVersion, setBufferVersion] = useState(0)

  if (prevViewModeUnitRef.current !== calendar.viewMode.unit) {
    prevViewModeUnitRef.current = calendar.viewMode.unit
    bufferRef.current = null
    prevPeriodRef.current = calendar.currentPeriod
  }

  if (isScheduleView && bufferRef.current === null && scheduleDays.length > 0) {
    bufferRef.current = {
      start: scheduleDays[0].isoDate,
      end: scheduleDays[scheduleDays.length - 1].isoDate,
    }
  }

  useEffect(() => {
    if (!isScheduleView) return
    if (calendar.currentPeriod === prevPeriodRef.current) return
    prevPeriodRef.current = calendar.currentPeriod

    let currentDays: typeof calendar.days
    if (calendar.viewMode.unit === 'day') {
      const currentDateStr = calendar.currentPeriod.split('[')[0]
      currentDays = calendar.days.filter(
        (day) =>
          day.date.toString({ calendarName: 'never' }) === currentDateStr,
      )
    } else {
      currentDays = calendar.days
    }

    if (currentDays.length === 0) return
    const newStart = currentDays[0].isoDate
    const newEnd = currentDays[currentDays.length - 1].isoDate

    if (navDirectionRef.current === 'none') {
      bufferRef.current = { start: newStart, end: newEnd }
    } else {
      const direction = navDirectionRef.current
      navDirectionRef.current = 'none'
      const prev = bufferRef.current ?? { start: newStart, end: newEnd }
      bufferRef.current = {
        start: newStart < prev.start ? newStart : prev.start,
        end: newEnd > prev.end ? newEnd : prev.end,
      }
      if (direction === 'backward') {
        prevScrollWidthRef.current = scrollRef.current?.scrollWidth ?? 0
        needsScrollAdjRef.current = true
      }
    }

    setBufferVersion((v) => v + 1)
  }, [
    calendar.currentPeriod,
    isScheduleView,
    calendar.viewMode.unit,
    calendar.days,
  ])

  useLayoutEffect(() => {
    if (!needsScrollAdjRef.current) return
    needsScrollAdjRef.current = false
    const el = scrollRef.current
    if (el) {
      el.scrollLeft += el.scrollWidth - prevScrollWidthRef.current
    }
  })

  const bufferedScheduleDays = useMemo(() => {
    void bufferVersion
    void calendar.days
    if (!bufferRef.current) return scheduleDays
    return calendar.getDaysInRange(bufferRef.current.start, bufferRef.current.end)
  }, [bufferVersion, scheduleDays, calendar.days, calendar.getDaysInRange])

  const periodDayCount =
    calendar.viewMode.unit === 'day' ? 1 : scheduleDays.length || 7

  const { startSentinelRef: leftSentinelRef, endSentinelRef: rightSentinelRef } =
    useInfiniteScroll({
      root: scrollRef,
      rootMargin: '0px 50%',
      cooldownMs: 300,
      onReachStart: () => {
        const el = scrollRef.current
        if (!el || el.scrollWidth <= el.clientWidth) return
        if (!calendar.canGoPreviousPeriod() || calendar.isPending) return
        navDirectionRef.current = 'backward'
        calendar.goToPreviousPeriod()
      },
      onReachEnd: () => {
        if (!calendar.canGoNextPeriod() || calendar.isPending) return
        navDirectionRef.current = 'forward'
        calendar.goToNextPeriod()
      },
      disabled: !isScheduleView,
    })

  return {
    scrollRef,
    leftSentinelRef,
    rightSentinelRef,
    bufferedScheduleDays,
    periodDayCount,
  }
}
