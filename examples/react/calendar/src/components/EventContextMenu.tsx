import type { CalendarInstance } from '@/lib/calendar'
import type { Event, RecurrenceEditScope, Resource } from '@tanstack/time'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'

/**
 * Shared `<ContextMenuContent>` body for an event. Each call site keeps its
 * own `<ContextMenu>`/`<ContextMenuTrigger>` (the triggers differ); only the
 * menu items are shared. `onEdit` opens the editor at the given scope.
 */
export function EventContextMenuItems({
  event,
  calendar,
  onEdit,
}: {
  event: Event<Resource>
  calendar: CalendarInstance
  onEdit: (event: Event<Resource>, scope?: RecurrenceEditScope) => void
}) {
  return (
    <ContextMenuContent>
      <ContextMenuItem onClick={() => onEdit(event)}>
        {event.recurrence ? 'Edit this occurrence' : 'Edit event'}
      </ContextMenuItem>
      {event.recurrence && (
        <>
          <ContextMenuItem onClick={() => onEdit(event, 'thisAndFollowing')}>
            Edit this and following
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onEdit(event, 'all')}>
            Edit series
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() =>
              calendar.goToPreviousOccurrence(event.id, event.start)
            }
          >
            ← Previous occurrence
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => calendar.goToNextOccurrence(event.id, event.start)}
          >
            Next occurrence →
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  )
}
