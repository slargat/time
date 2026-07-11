import { useCalendarContext } from '../../lib/calendar'
import { cn } from '@/lib/utils'

interface MonthModel {
  dayNames: Array<string>
  weeks: Array<{ days: Array<any> }>
}

/**
 * The month grid: a 7-wide header of weekday names, then the projected day
 * cells. Each non-empty cell is handed to `<calendar.AppDay>`, whose render-prop
 * child renders the registered `day.MonthDay` slot by name. Pure renderer.
 */
export function MonthView({ view }: { view: MonthModel }) {
  const calendar = useCalendarContext()
  const weekStartsOn = calendar.options.weekStartsOn ?? 1
  return (
    <section className="flex min-h-0 flex-1 flex-col text-sm text-muted-foreground">
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[auto] auto-rows-[1fr] overflow-hidden rounded-2xl bg-background divide-x divide-y">
        {view.dayNames.map((name, i) => {
          // Column i's ISO weekday (1=Mon..7=Sun), derived the same way
          // dayNames is generated, so weekend stays correct for any weekStartsOn.
          const dow = ((weekStartsOn - 1 + i) % 7) + 1
          return (
            <div
              key={name}
              className={cn(
                'px-1 py-2 text-center text-xs tracking-wider uppercase',
                dow >= 6 ? 'text-red-500' : 'text-muted-foreground',
              )}
            >
              {name}
            </div>
          )
        })}
        {view.weeks
          .flatMap((week) => week.days)
          .map((day, i) =>
            day ? (
              <calendar.AppDay key={day.isoDate} day={day}>
                {(day) => <day.MonthDay />}
              </calendar.AppDay>
            ) : (
              <div
                key={i}
                data-outside
                className="flex min-h-22 flex-col gap-1  bg-muted/50 p-1.5"
              />
            ),
          )}
      </div>
    </section>
  )
}
