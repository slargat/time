import { useState } from 'react'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { timeDevtoolsPlugin } from '@tanstack/react-time-devtools'
import { functionalUpdate } from '@tanstack/time-core'
import { TimelineView } from './components/calendar/timeline-view'
import { MonthView } from './components/calendar/month-view'
import { TimeGridView } from './components/calendar/week-view'
import { ViewTransition } from './components/calendar/view-transition'
import { useAppCalendar } from './lib/calendar'
import { events as initialEvents, resources } from './lib/fake-data'
import { ThemeProvider } from './components/theme-provider'
import { TooltipProvider } from './components/ui/tooltip'
import { SidebarInset, SidebarProvider } from './components/ui/sidebar'
import { AppHeader } from './components/app-header'
import { AppSidebar } from './components/app-sidebar'
import type { Event, ViewMode } from '@tanstack/time-core'

const MONTH: ViewMode = { value: 1, unit: 'month' }

export function App() {
  // `viewMode` is controlled by plain React state (1:1 with the table's
  // `state` + `on<Slice>Change`). Pass `state.viewMode` in; persist the
  // calendar's writes back out via `onViewModeChange`. `currentPeriod` stays
  // uncontrolled, so navigation still works through the default handler.
  const [viewMode] = useState<ViewMode>(MONTH)

  // Events are CONTROLLED (the v9 `data` channel): the app owns them in React
  // state; the calendar persists every internal mutation — CRUD, resize,
  // dependency cascades, lazy fetch — back out through `onEventsChange`, and we
  // re-feed the fresh `events` reference each render, which `setOptions`
  // re-syncs into the store.
  const [events, setEvents] = useState<Array<Event>>(initialEvents)

  const calendar = useAppCalendar({
    events,
    onEventsChange: (updater) =>
      setEvents((prev) => functionalUpdate(updater, prev)),
    resources,
    initialState: {
      viewMode,
    },
    weekStartsOn: 1,
    // resizeFeature: drives the resize controller; containerHeight matches the
    // day-cell min-height so pixel deltas map to sane time deltas.
    resize: { enabled: true, containerHeight: 88 },
  })

  // Re-render on any state change; getView() is recomputed below. The toolbar
  // and view leaves read the calendar/day/event from context (calendar.Calendar
  // provides it) — no instance props are drilled through the tree.
  const view = calendar.getView()

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <TooltipProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <calendar.AppCalendar>
            <div className="flex flex-1 h-full flex-col overflow-hidden [--header-height:calc(--spacing(14))]">
              <SidebarProvider
                className="flex flex-1 min-h-0 flex-col"
                defaultOpen={true}
              >
                <AppHeader />
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  <AppSidebar variant="inset" />
                  <SidebarInset className="min-h-0 overflow-hidden">
                    <ViewTransition
                      currentPeriod={calendar.state.currentPeriod}
                      viewMode={calendar.state.viewMode}
                    >
                      {view.view === 'timeline' && <TimelineView view={view} />}

                      {view.view === 'timeGrid' && <TimeGridView view={view} />}

                      {view.view === 'month' && <MonthView view={view} />}
                    </ViewTransition>
                  </SidebarInset>
                </div>
              </SidebarProvider>
            </div>
          </calendar.AppCalendar>
        </div>
        <TanStackDevtools
          config={{
            inspectHotkey: ['Shift' + 'Z' + 'E'],
            sourceAction: 'ide-warp',
            theme: 'dark',
          }}
          plugins={[timeDevtoolsPlugin()]}
        />
      </TooltipProvider>
    </ThemeProvider>
  )
}
