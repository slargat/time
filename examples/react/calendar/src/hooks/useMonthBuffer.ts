import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { useCalendar } from '@tanstack/react-time'
import type { Day, Event, Resource } from '@tanstack/time'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'

interface UseMonthBufferArgs {
  calendar: ReturnType<typeof useCalendar<Resource, Event<Resource>>>
  isScheduleView: boolean
}

interface UseMonthBufferResult {
  scrollRef: React.RefObject<HTMLDivElement | null>
  topSentinelRef: React.RefObject<HTMLDivElement | null>
  bottomSentinelRef: React.RefObject<HTMLDivElement | null>
  weekGroups: Array<Array<Day<Resource, Event<Resource>> | null>>
}

export function useMonthBuffer({
  calendar,
  isScheduleView,
}: UseMonthBufferArgs): UseMonthBufferResult {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bufferRef = useRef<{ start: string; end: string } | null>(null)
  const navDirectionRef = useRef<'none' | 'forward' | 'backward'>('none')
  const prevPeriodRef = useRef(calendar.currentPeriod)
  const prevScrollHeightRef = useRef(0)
  const needsScrollAdjRef = useRef(false)
  const prevViewModeUnitRef = useRef(calendar.viewMode.unit)
  const [bufferVersion, setBufferVersion] = useState(0)

  if (prevViewModeUnitRef.current !== calendar.viewMode.unit) {
    prevViewModeUnitRef.current = calendar.viewMode.unit
    bufferRef.current =
      calendar.days.length > 0
        ? {
            start: calendar.days[0].isoDate,
            end: calendar.days[calendar.days.length - 1].isoDate,
          }
        : null
    prevPeriodRef.current = calendar.currentPeriod
  }

  if (bufferRef.current === null && calendar.days.length > 0) {
    bufferRef.current = {
      start: calendar.days[0].isoDate,
      end: calendar.days[calendar.days.length - 1].isoDate,
    }
  }

  useEffect(() => {
    if (navDirectionRef.current === 'none') return
    if (calendar.currentPeriod === prevPeriodRef.current) return
    prevPeriodRef.current = calendar.currentPeriod

    const direction = navDirectionRef.current
    navDirectionRef.current = 'none'

    if (calendar.days.length === 0 || !bufferRef.current) return
    const newStart = calendar.days[0].isoDate
    const newEnd = calendar.days[calendar.days.length - 1].isoDate
    bufferRef.current = {
      start:
        newStart < bufferRef.current.start ? newStart : bufferRef.current.start,
      end: newEnd > bufferRef.current.end ? newEnd : bufferRef.current.end,
    }

    if (direction === 'backward') {
      prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0
      needsScrollAdjRef.current = true
    }

    setBufferVersion((v) => v + 1)
  }, [calendar.currentPeriod, calendar.days])

  useLayoutEffect(() => {
    if (!needsScrollAdjRef.current) return
    needsScrollAdjRef.current = false
    const el = scrollRef.current
    if (el) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current
    }
  })

  const weekGroups = useMemo(() => {
    void bufferVersion
    void calendar.days
    if (!bufferRef.current) return []
    const days = calendar.getDaysInRange(
      bufferRef.current.start,
      bufferRef.current.end,
    )
    return calendar.groupDaysBy({
      days,
      unit: 'week',
      fillMissingDays: true,
    })
  }, [
    bufferVersion,
    calendar.days,
    calendar.getDaysInRange,
    calendar.groupDaysBy,
  ])

  const {
    startSentinelRef: topSentinelRef,
    endSentinelRef: bottomSentinelRef,
  } = useInfiniteScroll({
    root: scrollRef,
    rootMargin: '120px 0px',
    cooldownMs: 1000,
    onReachStart: () => {
      const el = scrollRef.current
      if (!el || el.scrollHeight <= el.clientHeight) return
      if (!calendar.canGoPreviousPeriod() || calendar.isPending) return
      navDirectionRef.current = 'backward'
      calendar.goToPreviousPeriod()
    },
    onReachEnd: () => {
      if (!calendar.canGoNextPeriod() || calendar.isPending) return
      navDirectionRef.current = 'forward'
      calendar.goToNextPeriod()
    },
    disabled: isScheduleView,
  })

  return { scrollRef, topSentinelRef, bottomSentinelRef, weekGroups }
}
