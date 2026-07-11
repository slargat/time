import { createContext, use, useMemo, useRef } from 'react'
import { useCalendar } from './use-calendar'
import type { ComponentType, ReactNode } from 'react'
import type { CalendarStateSelector, ReactCalendar } from './use-calendar'
import type {
  CalendarFeatures,
  CalendarOptions,
  DayNode,
  Event,
  EventNode,
  Resource,
} from '@tanstack/time-core'

/**
 * Config for {@link createCalendarHook}. Modeled on the table library's
 * `createTableHook` (table→calendar, header→day, cell→event). There is no
 * `columnHelper` analog — calendars have no columns.
 *
 * `calendarComponents`/`dayComponents`/`eventComponents` are merged onto the
 * instance / day node / event node, the way the table merges
 * `tableComponents`/`headerComponents`/`cellComponents`.
 */
export interface CreateCalendarHookOptions<
  TFeatures extends CalendarFeatures,
  TCalComponents extends Record<string, ComponentType<any>>,
  TDayComponents extends Record<string, ComponentType<any>>,
  TEventComponents extends Record<string, ComponentType<any>>,
> {
  features: TFeatures
  /** Bound `DateCoreOptions` defaults (overridable per `useAppCalendar` call). */
  locale?: string
  timeZone?: string
  weekStartsOn?: number
  /**
   * Calendar-level components that need the calendar instance. Available on the
   * instance returned by `useAppCalendar` (e.g. `calendar.Navigation`). Use
   * `useCalendarContext()` inside them.
   */
  calendarComponents?: TCalComponents
  /**
   * Day-level components that need the day node. Available on the node handed to
   * `<calendar.AppDay>`'s render-prop child (e.g. `day.MonthDay`). Use
   * `useDayContext()` inside them.
   */
  dayComponents?: TDayComponents
  /**
   * Event-level components that need the event node. Available on the node handed
   * to `<calendar.AppEvent>`'s render-prop child (e.g. `event.MonthEvent`). Use
   * `useEventContext()` inside them.
   */
  eventComponents?: TEventComponents
}

/** Per-instance options for `useAppCalendar` — everything except the bound `features`. */
export type AppCalendarOptions<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> = Omit<CalendarOptions<TFeatures, TResource, TEvent>, 'features'>

// =============================================================================
// Wrapper component prop/types — mirror the table's AppTable/AppHeader/AppCell:
// render-prop children, plus an optional `selector` that re-renders only the
// wrapped subtree when the selected slice of calendar state changes.
// =============================================================================

/** `<calendar.AppCalendar>` — root provider. Maps to the table's `AppTable`. */
export interface AppCalendarPropsWithoutSelector {
  children: ReactNode
  selector?: never
}
export interface AppCalendarPropsWithSelector<TSelected> {
  selector: CalendarStateSelector<TSelected>
  children: (state: TSelected) => ReactNode
}
export interface AppCalendarComponent {
  (props: AppCalendarPropsWithoutSelector): ReactNode
  <TSelected>(props: AppCalendarPropsWithSelector<TSelected>): ReactNode
}

/** `<calendar.AppDay day={…}>` — wraps a day node. Maps to the table's `AppHeader`. */
export interface AppDayPropsWithoutSelector<
  TFeatures extends CalendarFeatures,
  TDayComponents,
> {
  day: DayNode<TFeatures, any, any>
  children: (day: DayNode<TFeatures, any, any> & TDayComponents) => ReactNode
  selector?: never
}
export interface AppDayPropsWithSelector<
  TFeatures extends CalendarFeatures,
  TDayComponents,
  TSelected,
> {
  day: DayNode<TFeatures, any, any>
  selector: CalendarStateSelector<TSelected>
  children: (
    day: DayNode<TFeatures, any, any> & TDayComponents,
    state: TSelected,
  ) => ReactNode
}
export interface AppDayComponent<
  TFeatures extends CalendarFeatures,
  TDayComponents,
> {
  (props: AppDayPropsWithoutSelector<TFeatures, TDayComponents>): ReactNode
  <TSelected>(
    props: AppDayPropsWithSelector<TFeatures, TDayComponents, TSelected>,
  ): ReactNode
}

/** `<calendar.AppEvent event={…}>` — wraps an event node. Maps to the table's `AppCell`. */
export interface AppEventPropsWithoutSelector<
  TFeatures extends CalendarFeatures,
  TEventComponents,
> {
  event: EventNode<TFeatures, any, any>
  children: (
    event: EventNode<TFeatures, any, any> & TEventComponents,
  ) => ReactNode
  selector?: never
}
export interface AppEventPropsWithSelector<
  TFeatures extends CalendarFeatures,
  TEventComponents,
  TSelected,
> {
  event: EventNode<TFeatures, any, any>
  selector: CalendarStateSelector<TSelected>
  children: (
    event: EventNode<TFeatures, any, any> & TEventComponents,
    state: TSelected,
  ) => ReactNode
}
export interface AppEventComponent<
  TFeatures extends CalendarFeatures,
  TEventComponents,
> {
  (props: AppEventPropsWithoutSelector<TFeatures, TEventComponents>): ReactNode
  <TSelected>(
    props: AppEventPropsWithSelector<TFeatures, TEventComponents, TSelected>,
  ): ReactNode
}

/** The instance from `useAppCalendar`: the calendar plus its App wrappers + slot components. */
export type AppReactCalendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
  TSelected,
  TCalComponents extends Record<string, ComponentType<any>>,
  TDayComponents extends Record<string, ComponentType<any>>,
  TEventComponents extends Record<string, ComponentType<any>>,
> = ReactCalendar<TFeatures, TResource, TEvent, TSelected> & {
  /** Provides the calendar context. Wrap the tree once at the root. */
  AppCalendar: AppCalendarComponent
  /** Provides a day node to its render-prop child (with `dayComponents` merged on). */
  AppDay: AppDayComponent<TFeatures, TDayComponents>
  /** Provides an event node to its render-prop child (with `eventComponents` merged on). */
  AppEvent: AppEventComponent<TFeatures, TEventComponents>
} & TCalComponents

/**
 * Bakes a feature set + component slots into context-bound hooks, so consumers
 * stop threading the `calendar`/`day`/`event` instances through props. Three
 * closure-scoped contexts are created per factory call (never shared).
 */
export function createCalendarHook<
  TFeatures extends CalendarFeatures,
  const TCalComponents extends Record<string, ComponentType<any>> = Record<
    string,
    never
  >,
  const TDayComponents extends Record<string, ComponentType<any>> = Record<
    string,
    never
  >,
  const TEventComponents extends Record<string, ComponentType<any>> = Record<
    string,
    never
  >,
>({
  calendarComponents,
  dayComponents,
  eventComponents,
  ...defaultOptions
}: CreateCalendarHookOptions<
  TFeatures,
  TCalComponents,
  TDayComponents,
  TEventComponents
>) {
  // Contexts hold the concrete TFeatures (so feature methods stay typed) but
  // widen resource/event to `any`, like the table's `<TFeatures, any, any>`.
  // Typed `| null` (default `null`) so the null-throw guards below are real
  // conditions, not unreachable ones.
  // The context carries the fully-assembled instance (App wrappers + slot
  // components merged on), so children reached via `useCalendarContext` can use
  // `calendar.AppDay`/`calendar.Navigation` by name.
  type ContextCalendar = AppReactCalendar<
    TFeatures,
    any,
    any,
    any,
    TCalComponents,
    TDayComponents,
    TEventComponents
  >
  const CalendarContext = createContext<ContextCalendar | null>(null)
  const DayContext = createContext<
    (DayNode<TFeatures, any, any> & TDayComponents) | null
  >(null)
  const EventContext = createContext<
    (EventNode<TFeatures, any, any> & TEventComponents) | null
  >(null)

  function useCalendarContext(): ContextCalendar {
    const calendar = use(CalendarContext)
    if (!calendar)
      throw new Error(
        'useCalendarContext must be used within <calendar.AppCalendar>',
      )
    return calendar
  }

  function useDayContext(): DayNode<TFeatures, any, any> & TDayComponents {
    const day = use(DayContext)
    if (!day) throw new Error('useDayContext must be used within <calendar.AppDay>')
    return day
  }

  function useEventContext(): EventNode<TFeatures, any, any> &
    TEventComponents {
    const event = use(EventContext)
    if (!event)
      throw new Error('useEventContext must be used within <calendar.AppEvent>')
    return event
  }

  function useAppCalendar<
    TResource extends Resource = Resource,
    TEvent extends Event<TResource> = Event<TResource>,
    TSelected = ReactCalendar<TFeatures, TResource, TEvent>['state'],
  >(
    options: AppCalendarOptions<TFeatures, TResource, TEvent>,
    selector?: CalendarStateSelector<TSelected>,
  ): AppReactCalendar<
    TFeatures,
    TResource,
    TEvent,
    TSelected,
    TCalComponents,
    TDayComponents,
    TEventComponents
  > {
    const calendar = useCalendar<TFeatures, TResource, TEvent, TSelected>(
      { ...defaultOptions, ...options } as CalendarOptions<
        TFeatures,
        TResource,
        TEvent
      >,
      selector,
    )

    // useCalendar returns a fresh `{ ...calendar, state }` spread each state
    // change, so the App wrappers read the latest instance through a ref while
    // keeping a stable identity (no provider-subtree remounts on every keystroke).
    const ref = useRef(calendar)
    ref.current = calendar

    // AppCalendar — root provider, with an optional Subscribe selector.
    const AppCalendar = useMemo(() => {
      function AppCalendarImpl(props: AppCalendarPropsWithoutSelector): ReactNode
      function AppCalendarImpl<TAppSelected>(
        props: AppCalendarPropsWithSelector<TAppSelected>,
      ): ReactNode
      function AppCalendarImpl<TAppSelected>(
        props:
          | AppCalendarPropsWithoutSelector
          | AppCalendarPropsWithSelector<TAppSelected>,
      ): ReactNode {
        const { children, selector: appSelector } = props as {
          children: ((state: TAppSelected) => ReactNode) | ReactNode
          selector?: CalendarStateSelector<TAppSelected>
        }
        const current = ref.current
        return (
          <CalendarContext value={current as unknown as ContextCalendar}>
            {appSelector ? (
              <current.Subscribe selector={appSelector}>
                {(state: TAppSelected) =>
                  (children as (state: TAppSelected) => ReactNode)(state)
                }
              </current.Subscribe>
            ) : (
              (children as ReactNode)
            )}
          </CalendarContext>
        )
      }
      return AppCalendarImpl as AppCalendarComponent
    }, [])

    // AppDay — provides a day node (with dayComponents merged on) to its child.
    const AppDay = useMemo(() => {
      function AppDayImpl(
        props: AppDayPropsWithoutSelector<TFeatures, TDayComponents>,
      ): ReactNode
      function AppDayImpl<TAppSelected>(
        props: AppDayPropsWithSelector<TFeatures, TDayComponents, TAppSelected>,
      ): ReactNode
      function AppDayImpl<TAppSelected>(
        props:
          | AppDayPropsWithoutSelector<TFeatures, TDayComponents>
          | AppDayPropsWithSelector<TFeatures, TDayComponents, TAppSelected>,
      ): ReactNode {
        const { day, children, selector: appSelector } = props as any
        const current = ref.current
        // Slot maps are merged onto the (per-render-fresh) node in place,
        // preserving its prototype methods — exactly like the table's
        // `Object.assign(cell, cellComponents)`.
        const extendedDay = Object.assign(
          day,
          dayComponents,
        ) as DayNode<TFeatures, any, any> & TDayComponents
        return (
          <DayContext value={extendedDay}>
            {appSelector ? (
              <current.Subscribe selector={appSelector}>
                {(state: TAppSelected) => children(extendedDay, state)}
              </current.Subscribe>
            ) : (
              children(extendedDay)
            )}
          </DayContext>
        )
      }
      return AppDayImpl as AppDayComponent<TFeatures, TDayComponents>
    }, [])

    // AppEvent — provides an event node (with eventComponents merged on).
    const AppEvent = useMemo(() => {
      function AppEventImpl(
        props: AppEventPropsWithoutSelector<TFeatures, TEventComponents>,
      ): ReactNode
      function AppEventImpl<TAppSelected>(
        props: AppEventPropsWithSelector<
          TFeatures,
          TEventComponents,
          TAppSelected
        >,
      ): ReactNode
      function AppEventImpl<TAppSelected>(
        props:
          | AppEventPropsWithoutSelector<TFeatures, TEventComponents>
          | AppEventPropsWithSelector<TFeatures, TEventComponents, TAppSelected>,
      ): ReactNode {
        const { event, children, selector: appSelector } = props as any
        const current = ref.current
        const extendedEvent = Object.assign(
          event,
          eventComponents,
        ) as EventNode<TFeatures, any, any> & TEventComponents
        return (
          <EventContext value={extendedEvent}>
            {appSelector ? (
              <current.Subscribe selector={appSelector}>
                {(state: TAppSelected) => children(extendedEvent, state)}
              </current.Subscribe>
            ) : (
              children(extendedEvent)
            )}
          </EventContext>
        )
      }
      return AppEventImpl as AppEventComponent<TFeatures, TEventComponents>
    }, [])

    return Object.assign(
      calendar,
      { AppCalendar, AppDay, AppEvent },
      calendarComponents,
    ) as never
  }

  return {
    appFeatures: defaultOptions.features,
    useAppCalendar,
    useCalendarContext,
    useDayContext,
    useEventContext,
  }
}
