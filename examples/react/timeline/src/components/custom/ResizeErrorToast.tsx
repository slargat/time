import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ResizeError } from '@tanstack/time'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ResizeErrorToast({
  error,
  onDismiss,
}: {
  error: ResizeError
  onDismiss: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
      <Card className="max-w-md border-destructive/50 bg-destructive/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="text-destructive text-lg">!</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-destructive-foreground mb-1">
                Cannot Resize{' '}
                <span className="italic">&ldquo;{error.eventTitle}&rdquo;</span>
              </div>
              <div className="text-sm text-destructive-foreground/80 mb-2">
                {error.message}
              </div>
              {error.conflicts && error.conflicts.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-destructive-foreground/70 font-medium uppercase tracking-wide">
                    Dependency conflicts:
                  </div>
                  {error.conflicts.map((conflict, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-destructive-foreground/70 bg-destructive/20 rounded px-2 py-1.5 border border-destructive/30"
                    >
                      <div className="font-medium text-destructive-foreground/90">
                        {conflict.date}{' '}
                        <span className="text-destructive">
                          {conflict.conflictRange.start}–
                          {conflict.conflictRange.end}
                        </span>
                      </div>
                      <div className="text-destructive-foreground/50 mt-0.5">
                        {conflict.description}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-6 w-6 text-destructive/60 hover:text-destructive hover:bg-destructive/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
