import { ScrollArea } from '@/components/ui/scroll-area'

interface TimelineModel {
  timeSlots: Array<{ hour: number; minute: number; label: string }>
  lanes: Array<{
    resource: { id: string; label: string }
    events: Array<{ id: string; title: string }>
  }>
}

/**
 * The timeline view: a shared time axis with one {@link Lane} per resource. Pure
 * renderer — lanes/events come straight from the core view model.
 */
export function TimelineView({ view }: { view: TimelineModel }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid min-w-max grid-cols-[120px_repeat(24,minmax(56px,1fr))] overflow-hidden rounded-2xl border border-border">
        <div className="sticky left-0 z-20 border-r border-b border-border bg-muted" />
        {view.timeSlots.map((slot) => (
          <div
            key={slot.label}
            className="border-b border-l border-border bg-muted px-1 py-2 text-center text-[11px] whitespace-nowrap text-muted-foreground"
          >
            {slot.label}
          </div>
        ))}
        {view.lanes.map((lane) => (
          <Lane
            key={lane.resource.id}
            label={lane.resource.label}
            count={view.timeSlots.length}
            events={lane.events}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function Lane(props: {
  label: string
  count: number
  events: Array<{ id: string; title: string }>
}) {
  return (
    <>
      <div className="sticky left-0 z-10 flex items-center border-r border-b border-border bg-muted px-3 py-2.5 text-[13px] font-medium">
        {props.label}
      </div>
      <div
        className="flex min-h-11 items-center gap-1.5 border-b border-border px-3 py-2.5"
        style={{ gridColumn: `span ${props.count}` }}
      >
        {props.events.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            no events (grouping pending)
          </span>
        ) : (
          props.events.map((e) => (
            <span
              key={e.id}
              className="rounded border border-primary bg-primary/20 px-2 py-0.5 text-xs"
            >
              {e.title}
            </span>
          ))
        )}
      </div>
    </>
  )
}
