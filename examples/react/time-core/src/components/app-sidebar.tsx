import { CalendarIcon } from 'lucide-react'
import { useCalendarContext } from '../lib/calendar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
} from './ui/sidebar'
import { MonthPicker } from './calendar/month-picker'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const calendar = useCalendarContext()
  const locale = calendar.options.locale ?? 'en-US'
  const weekStartsOn = calendar.options.weekStartsOn ?? 1
  return (
    <Sidebar
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
      {...props}
    >
      <SidebarHeader className="p-0">
        <calendar.Subscribe selector={(state) => state.currentPeriod}>
          {(currentPeriod) => (
            <MonthPicker
              selected={currentPeriod}
              locale={locale}
              weekStartsOn={weekStartsOn}
              onSelect={(date) => calendar.goToSpecificPeriod(date.toString())}
            />
          )}
        </calendar.Subscribe>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuButton>
                <CalendarIcon />
                <span>
                  Powered by
                  <a href="https://tanstack.com/time">TanStack Time</a>
                </span>
              </SidebarMenuButton>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}
