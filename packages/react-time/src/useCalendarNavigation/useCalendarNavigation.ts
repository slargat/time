import { useCallback, useTransition } from 'react'
import { useStore } from '@tanstack/react-store'
import { useCalendarContext } from '../CalendarProvider/CalendarProvider'
import type { Event, Resource, ViewMode } from '@tanstack/time'

export interface UseCalendarNavigationReturn {
  activeDate: string
  currentPeriod: string
  viewMode: ViewMode
  /** Localised label for the visible period (e.g. "June 2026"). */
  label: string
  isPending: boolean
  goToNextPeriod: () => void
  goToPreviousPeriod: () => void
  goToCurrentPeriod: () => void
  goToSpecificPeriod: (date: string) => void
  changeViewMode: (viewMode: ViewMode) => void
  canGoNextPeriod: () => boolean
  canGoPreviousPeriod: () => boolean
}

/**
 * Period navigation + view-mode controls. Subscribes only to the navigation
 * slice of the store, so event mutations do not re-render consumers.
 */
export function useCalendarNavigation<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(): UseCalendarNavigationReturn {
  const { core } = useCalendarContext<TResource, TEvent>()

  const slice = useStore(core.store, (state) => ({
    activeDate: state.activeDate.toString(),
    currentPeriod: state.currentPeriod.toString(),
    viewMode: state.viewMode,
    isPending: state.isPending,
  }))

  const [isTransitionPending, startTransition] = useTransition()

  const goToNextPeriod = useCallback(() => {
    startTransition(() => core.goToNextPeriod())
  }, [core])

  const goToPreviousPeriod = useCallback(() => {
    startTransition(() => core.goToPreviousPeriod())
  }, [core])

  const goToCurrentPeriod = useCallback(() => {
    startTransition(() => core.goToCurrentPeriod())
  }, [core])

  const goToSpecificPeriod = useCallback(
    (date: string) => {
      startTransition(() => core.goToSpecificPeriod(date))
    },
    [core],
  )

  const changeViewMode = useCallback(
    (viewMode: ViewMode) => {
      startTransition(() => core.changeViewMode(viewMode))
    },
    [core],
  )

  const canGoNextPeriod = useCallback(
    () => core.canGoNextPeriod(),
    [core],
  )

  const canGoPreviousPeriod = useCallback(
    () => core.canGoPreviousPeriod(),
    [core],
  )

  return {
    activeDate: slice.activeDate,
    currentPeriod: slice.currentPeriod,
    viewMode: slice.viewMode,
    label: core.formatPeriodLabel(),
    isPending: isTransitionPending || slice.isPending,
    goToNextPeriod,
    goToPreviousPeriod,
    goToCurrentPeriod,
    goToSpecificPeriod,
    changeViewMode,
    canGoNextPeriod,
    canGoPreviousPeriod,
  }
}
