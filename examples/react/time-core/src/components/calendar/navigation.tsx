import { useState } from 'react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { Popover } from '@base-ui/react/popover'
import { useCalendarContext } from '../../lib/calendar'
import { periodLabel } from '../../lib/period-label'
import { MonthPicker } from './month-picker'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/components/ui/sidebar'

/** Navigation toolbar. Reads the calendar from context — no prop drilling. */
export function Navigation() {
  const calendar = useCalendarContext()
  // Sidebar open → the mini-calendar lives in the sidebar, so the header label
  // is a plain span. Sidebar closed → expose it via the popover dropdown.
  const { open: sidebarOpen } = useSidebar()
  const [open, setOpen] = useState(false)
  const locale = calendar.options.locale ?? 'en-US'
  const weekStartsOn = calendar.options.weekStartsOn ?? 1
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="lg"
        onClick={() => calendar.goToCurrentPeriod()}
      >
        Today
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => calendar.goToPreviousPeriod()}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => calendar.goToNextPeriod()}
      >
        <ChevronRightIcon />
      </Button>
      <calendar.Subscribe
        selector={(state) => ({
          currentPeriod: state.currentPeriod,
          viewMode: state.viewMode,
        })}
      >
        {({ currentPeriod, viewMode }) => {
          const label = periodLabel(currentPeriod, viewMode, {
            locale,
            weekStartsOn,
          })
          if (sidebarOpen)
            return (
              <span className="px-3 text-lg font-semibold first-letter:uppercase">
                {label}
              </span>
            )
          return (
            <Popover.Root open={open} onOpenChange={setOpen}>
              <Popover.Trigger
                render={
                  <Button
                    variant="ghost"
                    size="lg"
                    className="gap-1 font-semibold "
                  >
                    <span className="first-letter:uppercase">{label}</span>
                    <ChevronDownIcon className="size-4 opacity-60" />
                  </Button>
                }
              />
              <Popover.Portal>
                <Popover.Positioner sideOffset={8} align="start">
                  <Popover.Popup className="z-50 w-64 rounded-xl border bg-popover text-popover-foreground shadow-md outline-none">
                    <MonthPicker
                      selected={currentPeriod}
                      locale={locale}
                      weekStartsOn={weekStartsOn}
                      onSelect={(date) => {
                        calendar.goToSpecificPeriod(date.toString())
                        setOpen(false)
                      }}
                    />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )
        }}
      </calendar.Subscribe>
    </div>
  )
}
