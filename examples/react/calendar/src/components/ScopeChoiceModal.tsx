import type { Event, RecurrenceEditScope, Resource } from '@tanstack/time'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ScopeChoiceModal({
  event,
  isOpen,
  title = 'Edit recurring event',
  onSelect,
  onClose,
}: {
  event: Event<Resource> | null
  isOpen: boolean
  title?: string
  onSelect: (scope: RecurrenceEditScope) => void
  onClose: () => void
}) {
  if (!isOpen) return null
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs bg-card border-border">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 text-sm text-neutral-400">
          {event?.title ?? 'Choose how to apply this recurring-event change.'}
        </div>
        <div className="space-y-2 mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelect('this')}
          >
            This occurrence
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelect('thisAndFollowing')}
          >
            This and following
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start"
            onClick={() => onSelect('all')}
          >
            All events
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
