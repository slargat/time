import React from 'react'
import { useCalendarContext } from '../../lib/calendar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** The header bar. Reads the calendar from context — nothing is drilled in. */
export function Toolbar({
  className,
  ...props
}: React.ComponentProps<'header'>) {
  const calendar = useCalendarContext()
  return (
    <header className={cn('w-full', className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <calendar.Navigation />
          <Badge variant="outline">
            {calendar.state.currentPeriod.toString()}
          </Badge>
          <Badge variant="secondary">{calendar.state.viewMode.unit}</Badge>
        </div>
      </div>
    </header>
  )
}
