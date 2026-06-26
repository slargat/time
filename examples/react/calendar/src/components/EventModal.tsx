import { useEffect, useState } from 'react'
import type {
  RecurrenceEditScope,
  RecurrenceFrequency,
  Resource,
} from '@tanstack/time'
import type { EventFormData } from '@/lib/eventForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  isRecurring,
  mode,
  isSaving,
  resources,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: EventFormData) => Promise<void>
  onDelete?: (data: EventFormData) => void
  initialData: EventFormData
  mode: 'add' | 'edit'
  isRecurring?: boolean
  isSaving?: boolean
  resources: Array<Resource>
}) {
  const [formData, setFormData] = useState<EventFormData>(initialData)

  useEffect(() => {
    setFormData(initialData)
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSave(formData)
    } catch {
      return
    }
    onClose()
  }

  const recurrencyOptions: Array<{
    value: RecurrenceFrequency | 'none'
    label: string
  }> = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ]

  const recurrenceEditScopeOptions: Array<{
    value: RecurrenceEditScope
    label: string
  }> = [
    { value: 'this', label: 'This event only' },
    { value: 'thisAndFollowing', label: 'This and following events' },
    { value: 'all', label: 'All events in series' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add Event' : 'Edit Event'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Event title"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="allDay"
              type="checkbox"
              checked={formData.allDay}
              onChange={(e) =>
                setFormData({ ...formData, allDay: e.target.checked })
              }
              className="h-4 w-4"
            />
            <Label htmlFor="allDay" className="cursor-pointer">
              All-day
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData({ ...formData, startDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                disabled={formData.allDay}
                required={!formData.allDay}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resourceId">Resource</Label>
              <select
                id="resourceId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.resourceId}
                onChange={(e) =>
                  setFormData({ ...formData, resourceId: e.target.value })
                }
                required
              >
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="consumption">Consumption</Label>
              <Input
                id="consumption"
                type="number"
                min={1}
                step={1}
                value={formData.consumption}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    consumption: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                disabled={formData.allDay}
                required={!formData.allDay}
              />
            </div>
          </div>

          {mode === 'edit' && isRecurring && (
            <div className="space-y-2 rounded-md border border-neutral-800 bg-neutral-950/60 p-3">
              <Label htmlFor="recurrenceEditScope">Apply changes to</Label>
              <select
                id="recurrenceEditScope"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={formData.recurrenceEditScope}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    recurrenceEditScope: e.target.value as RecurrenceEditScope,
                  })
                }
              >
                {recurrenceEditScopeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                Save or Delete uses selected recurring-event scope.
              </p>
            </div>
          )}

          {/* ── Recurrence ───────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="recurrenceFrequency">Repeat</Label>
            <select
              id="recurrenceFrequency"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={formData.recurrenceFrequency}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  recurrenceFrequency: e.target.value as
                    | RecurrenceFrequency
                    | 'none',
                })
              }
            >
              {recurrencyOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {formData.recurrenceFrequency !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="recurrenceUntil">Repeat until (optional)</Label>
              <Input
                id="recurrenceUntil"
                type="date"
                value={formData.recurrenceUntil}
                onChange={(e) =>
                  setFormData({ ...formData, recurrenceUntil: e.target.value })
                }
              />
            </div>
          )}

          <div className="flex justify-between pt-4">
            <div>
              {mode === 'edit' && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    onDelete(formData)
                    onClose()
                  }}
                >
                  Delete
                  {isRecurring
                    ? ` ${formData.recurrenceEditScope === 'this' ? 'this event' : formData.recurrenceEditScope === 'thisAndFollowing' ? 'this and following' : 'series'}`
                    : ''}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving…' : mode === 'add' ? 'Add' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
