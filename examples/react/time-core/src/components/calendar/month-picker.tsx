import { useState } from 'react'
import { Temporal } from '@js-temporal/polyfill'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * A compact month grid for jumping to a date (the Google-calendar header
 * dropdown). Self-contained: local `viewMonth` paging, calls `onSelect` with the
 * chosen `Temporal.PlainDate`. Highlights today + the currently selected period.
 */
export function MonthPicker({
  selected,
  locale,
  weekStartsOn,
  onSelect,
}: {
  selected: Temporal.PlainDate
  locale: string
  weekStartsOn: number
  onSelect: (date: Temporal.PlainDate) => void
}) {
  const today = Temporal.Now.plainDateISO()
  const [viewMonth, setViewMonth] = useState(() => selected.with({ day: 1 }))

  // 6×7 grid starting on the configured first weekday of the month's first week.
  const firstCell = viewMonth.subtract({
    days: (viewMonth.dayOfWeek - weekStartsOn + 7) % 7,
  })
  const cells = Array.from({ length: 42 }, (_, i) => firstCell.add({ days: i }))
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    firstCell.add({ days: i }).toLocaleString(locale, { weekday: 'narrow' }),
  )

  return (
    <div className="w-full p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium first-letter:uppercase">
          {viewMonth.toLocaleString(locale, { month: 'long', year: 'numeric' })}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            onClick={() => setViewMonth((m) => m.subtract({ months: 1 }))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 rounded-full"
            onClick={() => setViewMonth((m) => m.add({ months: 1 }))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1 text-xs text-muted-foreground">
            {w}
          </span>
        ))}
        {cells.map((d) => {
          const inMonth =
            d.month === viewMonth.month && d.year === viewMonth.year
          const isToday = d.equals(today)
          const isSelected = d.equals(selected)
          return (
            <button
              key={d.toString()}
              onClick={() => onSelect(d)}
              className={cn(
                'flex aspect-square items-center justify-center rounded-full text-xs hover:bg-muted',
                !inMonth && 'text-muted-foreground/40',
                isToday && !isSelected && 'font-semibold text-primary',
                isSelected &&
                  'bg-primary font-semibold text-primary-foreground hover:bg-primary',
              )}
            >
              {d.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
