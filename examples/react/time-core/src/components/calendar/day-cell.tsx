import { useCalendarContext, useDayContext } from '../../lib/calendar'
import { cn } from '@/lib/utils'

/**
 * A single month-grid cell: the day number plus its events. Wires
 * `getColumnProps()` (resize drop target) and reads its day node from context
 * (`<calendar.AppDay day=…>`) — no prop drilling. Each event is handed to
 * `<calendar.AppEvent>`, which renders the `event.MonthEvent` slot by name.
 */
export function MonthDay() {
  const day = useDayContext()
  const calendar = useCalendarContext()
  return (
    <div
      ref={day.getColumnProps().ref}
      data-today={day.isToday}
      data-outside={!day.isInCurrentPeriod}
      // cn/tailwind-merge: last present class wins — today's bg keeps its
      // highlight over the out-of-month grey. Weekends carry no cell bg in
      // month view; the red header name marks them.
      className={cn(
        'group/cell flex min-h-22 flex-col gap-1 p-1.5',
        !day.isInCurrentPeriod && 'bg-muted/50',
        day.isToday && 'bg-primary/10',
      )}
    >
      <span
        className={cn(
          'text-xs text-foreground',
          !day.isInCurrentPeriod && 'text-muted-foreground',
          day.isToday && 'font-semibold text-primary',
        )}
      >
        {day.date.day}
      </span>
      {day.events.map((event) => (
        <calendar.AppEvent key={event.id} event={event}>
          {(event) => <event.MonthEvent />}
        </calendar.AppEvent>
      ))}
    </div>
  )
}
