import { MenuIcon, SettingsIcon } from 'lucide-react'
import { SidebarTrigger } from './ui/sidebar'
import { Button } from './ui/button'
import { ViewSwitcher } from './calendar/view-switcher'
import { ModeToggle } from './mode-toggle'
import { useCalendarContext } from '@/lib/calendar'

export function AppHeader() {
  const calendar = useCalendarContext()

  return (
    <header className="sticky top-0 z-50 flex w-full items-center">
      <div className="flex h-(--header-height) w-full items-center justify-between px-2">
        <div className="flex items-center gap-2 ">
          <div className="flex itZEems-center gap-2 w-[calc(var(--sidebar-width)-10px)]">
            <SidebarTrigger
              render={
                <Button variant="ghost" size="icon">
                  <MenuIcon />
                </Button>
              }
            />

            <h1 className="text-2xl font-bold whitespace-nowrap ">
              TanStack Time
            </h1>
          </div>
          <calendar.Navigation />
        </div>
        <div className="grid grid-flow-col gap-2">
          <Button variant="ghost" size="icon">
            <SettingsIcon />
          </Button>
          <ViewSwitcher />
          <ModeToggle variant="ghost" />
        </div>
      </div>
    </header>
  )
}
