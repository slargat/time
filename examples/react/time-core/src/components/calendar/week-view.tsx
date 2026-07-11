import { useTransition } from 'react'
import { useCalendarContext } from '../../lib/calendar'
import { Button, buttonVariants } from '../ui/button'
import { GridDay } from './day-view'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface TimeGridModel {
  timeSlots: Array<{ hour: number; minute: number; label: string }>
  days: Array<any>
  nowTop: number
}

/**
 * The week / work-week / day time grid (the `timeGrid` view). A pure renderer:
 * the day header strip, the all-day strip, the hour axis, then one
 * {@link DayColumn} per day. Column count is data-driven (`days.length`), so the
 * same component serves all three units — no `mode` prop.
 */
export function TimeGridView({ view }: { view: TimeGridModel }) {
  const calendar = useCalendarContext()

  const [, startTransition] = useTransition()

  const cols = { gridTemplateColumns: `repeat(${view.days.length}, 1fr)` }
  const locale = calendar.options.locale ?? 'en-US'
  // DST-aware UTC offset for the calendar's timezone, e.g. "GMT+02".
  const gmt =
    new Intl.DateTimeFormat('en-US', {
      timeZone: calendar.options.timeZone ?? 'UTC',
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')
      ?.value.replace(/GMT([+-])(\d)(?!\d)/, 'GMT$10$2') ?? 'GMT'

  function handleGoToDay(day: any) {
    calendar.changeViewMode({ unit: 'day', value: 1 })
    startTransition(() => {
      calendar.goToSpecificPeriod(day.date)
    })
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
      <div className="grid grid-cols-[70px_1fr]">
        <div className="" />
        <div className="grid " style={cols}>
          {view.days.map((day) => {
            const weekend = day.date.dayOfWeek >= 6
            const weekdayLabel = day.date.toLocaleString(locale, {
              weekday: 'short',
            })
            const labelClass = `text-xs font-medium tracking-wide uppercase`
            const numberLabel = day.date.toLocaleString(locale, {
              day: 'numeric',
            })
            const numberVariant = day.isToday ? 'default' : 'ghost'
            const numberClass = cn(
              'text-2xl font-light tabular-nums',
              day.isToday && 'bg-primary text-primary-foreground',
            )
            // Same UI for every unit; day view is non-interactive (no period to
            // jump to), so it renders spans instead of go-to-day buttons.
            return (
              <div
                key={day.isoDate}
                className={`flex flex-col items-center gap-1 py-2 ${weekend ? 'bg-muted/40' : ''}`}
              >
                <calendar.Subscribe selector={(state) => state.viewMode}>
                  {(viewMode) =>
                    viewMode.unit === 'day' ? (
                      <>
                        <span className={labelClass}>{weekdayLabel}</span>
                        <span
                          className={cn(
                            buttonVariants({
                              variant: day.isToday ? 'default' : 'ghost',
                              size: 'icon-lg',
                            }),
                            numberClass,
                          )}
                        >
                          {numberLabel}
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          className={labelClass}
                          onClick={() => handleGoToDay(day)}
                        >
                          {weekdayLabel}
                        </button>
                        <Button
                          size="icon-lg"
                          variant={numberVariant}
                          className={numberClass}
                          onClick={() => handleGoToDay(day)}
                        >
                          {numberLabel}
                        </Button>
                      </>
                    )
                  }
                </calendar.Subscribe>
              </div>
            )
          })}
        </div>
      </div>

      {/* all-day strip: day.allDayEvents come from the core day nodes. */}
      <div className="grid grid-cols-[70px_1fr] border-b divide-x">
        <div className="p-1.5 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {gmt}
        </div>
        <div className="grid divide-x divide-border" style={cols}>
          {view.days.map((day) => (
            <div
              key={day.isoDate}
              className={`flex min-h-6 flex-col gap-0.5 p-1 ${day.date.dayOfWeek >= 6 ? 'bg-muted/40' : ''}`}
            >
              {day.allDayEvents.map((event: any) => (
                <span
                  key={event.id}
                  className="rounded border px-1.5 py-px text-xs"
                >
                  {event.title}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 bg-background">
        {/* -mt-px tucks the 00:00 gridline under the all-day border so they
            merge into one line instead of doubling, while every hour gridline
            stays aligned with its gutter tick + label. */}
        <div className="-mt-px grid grid-cols-[70px_1fr] divide-x">
          <div className="bg-background">
            {view.timeSlots.map((slot, i) => (
              <div
                key={slot.label}
                className={`relative h-12 ${i > 0 ? "after:absolute after:top-0 after:right-0 after:w-2 after:border-t after:border-border after:content-['']" : ''}`}
              >
                {i > 0 && (
                  <span className="absolute top-0 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                    {slot.label}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="grid divide-x divide-border" style={cols}>
            {view.days.map((day) => (
              <calendar.AppDay key={day.isoDate} day={day}>
                {() => <GridDay nowTop={view.nowTop} />}
              </calendar.AppDay>
            ))}
          </div>
        </div>
      </ScrollArea>
    </section>
  )
}
