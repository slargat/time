import { useEventContext } from '../../lib/calendar'

/**
 * An event in the month grid: inline flow, title + a bottom resize handle.
 * Reads its event node from context (`<Event event=…>`) — no prop drilling.
 */
export function MonthEvent() {
  const event = useEventContext()
  return (
    <span className="group/event relative rounded border border-primary bg-primary/20 px-2 py-0.5 text-xs">
      {event.title}
      <span
        className="absolute inset-x-0 bottom-0 h-1.25 cursor-ns-resize rounded-b bg-primary opacity-0 group-hover/event:opacity-80"
        {...event.getResizeHandleProps('bottom')}
      />
    </span>
  )
}

/**
 * An event in the time grid: absolutely positioned by its core-computed
 * `getEventProps().style`, with top + bottom resize handles. Reads its event
 * node from context.
 */
export function GridEvent() {
  const event = useEventContext()
  return (
    <div
      className="group/event absolute overflow-hidden rounded border border-primary bg-primary/20 px-1.5 py-0.5 text-[11px] leading-[1.3] text-foreground"
      style={event.getEventProps().style}
    >
      <span
        className="absolute inset-x-0 top-0 h-1.25 cursor-ns-resize rounded-t bg-primary opacity-0 group-hover/event:opacity-80"
        {...event.getResizeHandleProps('top')}
      />
      {event.title}
      <span
        className="absolute inset-x-0 bottom-0 h-1.25 cursor-ns-resize rounded-b bg-primary opacity-0 group-hover/event:opacity-80"
        {...event.getResizeHandleProps('bottom')}
      />
    </div>
  )
}
