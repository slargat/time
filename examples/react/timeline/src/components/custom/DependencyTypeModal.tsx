import type { DependencyType } from '@tanstack/time'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ALL_DEP_TYPES, DEP_TYPE_STYLES } from '@/lib/dep-styles'

export function DependencyTypeModal({
  isOpen,
  sourceTitle,
  targetTitle,
  onChoose,
  onCancel,
}: {
  isOpen: boolean
  sourceTitle: string
  targetTitle: string
  onChoose: (type: DependencyType) => void
  onCancel: () => void
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link dependency</DialogTitle>
          <DialogDescription>
            Choose how{' '}
            <span className="font-semibold">&ldquo;{targetTitle}&rdquo;</span>{' '}
            depends on{' '}
            <span className="font-semibold">&ldquo;{sourceTitle}&rdquo;</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 py-2">
          {ALL_DEP_TYPES.map((type) => {
            const style = DEP_TYPE_STYLES[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => onChoose(type)}
                className="group flex items-center gap-3 rounded-md border border-neutral-700 bg-neutral-900/40 px-3 py-2.5 text-left transition-colors hover:border-neutral-500 hover:bg-neutral-800/60 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              >
                <span
                  className={`${style.badgeBg} text-white text-xs font-bold rounded px-2 py-1 min-w-[2.5rem] text-center`}
                >
                  {style.label}
                </span>
                <span className="text-sm text-neutral-200">
                  {style.description}
                </span>
              </button>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
