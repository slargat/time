import { createContext, createElement, use, useMemo } from 'react'
import type { ReactNode } from 'react'
import type {
  CalendarCore,
  Event,
  ResizeController,
  Resource,
} from '@tanstack/time'
import type { UseCalendarReturn } from '../useCalendar/useCalendar'

/** Stable values shared through the calendar context. */
export interface CalendarContextValue<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
> {
  core: CalendarCore<TResource, TEvent>
  resizeController: ResizeController<TResource, TEvent>
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export interface CalendarProviderProps<
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  /** The result of {@link useCalendar}. */
  value: UseCalendarReturn<TResource, TEvent>
  children: ReactNode
}

/**
 * Provides a calendar instance to descendant hooks (`useCalendarNavigation`,
 * `useMonthGrid`, `useScheduleGrid`, `useEvent`). The provided context value is
 * the stable `{ core, resizeController }` pair, so descendants subscribe to
 * store slices independently instead of re-rendering on every change.
 */
export function CalendarProvider<
  TResource extends Resource,
  TEvent extends Event<TResource>,
>({ value, children }: CalendarProviderProps<TResource, TEvent>) {
  const { core, resizeController } = value
  const contextValue = useMemo(
    () => ({ core, resizeController }),
    [core, resizeController],
  )

  return createElement(
    CalendarContext.Provider,
    { value: contextValue as unknown as CalendarContextValue },
    children,
  )
}

/**
 * Reads the calendar context provided by {@link CalendarProvider}. Throws when
 * used outside a provider.
 */
export function useCalendarContext<
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(): CalendarContextValue<TResource, TEvent> {
  const context = use(CalendarContext)
  if (context === null) {
    throw new Error(
      'useCalendarContext must be used within a <CalendarProvider>',
    )
  }
  return context as unknown as CalendarContextValue<TResource, TEvent>
}
