import { useCalendarContext, useDayContext } from '../../lib/calendar'

/**
 * A single day column in the time grid: the core-computed now-line (only when
 * this day is today) plus each event, handed to `<calendar.AppEvent>` so the
 * `event.GridEvent` slot positions itself from `getEventProps().style`. The
 * week, work-week and day views all compose this same column. Reads its day node
 * from context (`<calendar.AppDay day=…>`); `nowTop` is view data, so it stays a prop.
 */
export function GridDay({ nowTop }: { nowTop: number }) {
  const day = useDayContext()
  const calendar = useCalendarContext()
  return (
    <div
      ref={day.getColumnProps().ref}
      className={`relative h-288 bg-size-[100%_48px] bg-[linear-gradient(var(--color-border)_1px,transparent_1px)] ${day.date.dayOfWeek >= 6 ? 'bg-muted/40' : ''}`}
    >
      {day.isToday ? (
        <div
          className="absolute inset-x-0 z-5 h-0 border-t-2 border-t-destructive before:absolute before:-top-1 before:-left-0.75 before:size-1.75 before:rounded-full before:bg-destructive before:content-['']"
          style={{ top: `${nowTop}%` }}
        />
      ) : null}
      {day.events.map((event) => (
        <calendar.AppEvent key={event.id} event={event}>
          {(event) => <event.GridEvent />}
        </calendar.AppEvent>
      ))}
    </div>
  )
}
