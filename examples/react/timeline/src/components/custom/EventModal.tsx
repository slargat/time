import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { DependencyType, Event, Resource } from '@tanstack/time'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ALL_DEP_TYPES } from '@/lib/dep-styles'
import { sampleResources } from '@/data/samples'
import type { EventFormData } from '@/types'

export function EventModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialData,
  mode,
  isSaving,
  allEvents,
  editingEventId,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: EventFormData) => Promise<void>
  onDelete?: () => void
  initialData: EventFormData
  mode: 'add' | 'edit'
  isSaving?: boolean
  allEvents: Array<Event<Resource>>
  editingEventId?: string
}) {
  const [formData, setFormData] = useState<EventFormData>(initialData)

  useEffect(() => {
    setFormData(initialData)
  }, [initialData, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSave(formData)
    } catch {
      return
    }
    onClose()
  }

  const dependableEvents = allEvents.filter((e) => e.id !== editingEventId)

  const addDependency = () => {
    const candidate = dependableEvents.find(
      (e) => !formData.dependsOn.some((d) => d.id === e.id),
    )
    if (!candidate) return
    setFormData({
      ...formData,
      dependsOn: [...formData.dependsOn, { id: candidate.id, type: 'FS' }],
    })
  }

  const updateDependency = (
    index: number,
    patch: Partial<{ id: string; type: DependencyType }>,
  ) => {
    setFormData({
      ...formData,
      dependsOn: formData.dependsOn.map((d, i) =>
        i === index ? { ...d, ...patch } : d,
      ),
    })
  }

  const removeDependency = (index: number) => {
    setFormData({
      ...formData,
      dependsOn: formData.dependsOn.filter((_, i) => i !== index),
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add Event' : 'Edit Event'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Create a new event on the timeline.'
              : 'Make changes to your event here.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resource">Resource</Label>
              <Select
                value={formData.resourceId}
                onValueChange={(value) =>
                  setFormData({ ...formData, resourceId: value })
                }
              >
                <SelectTrigger id="resource">
                  <SelectValue placeholder="Select a resource" />
                </SelectTrigger>
                <SelectContent>
                  {sampleResources.map((r) => {
                    const cap = r.capacity?.reduce((a, b) => a + b, 0)
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                        {cap ? ` (cap ${cap})` : ''}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
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
                required
              />
            </div>
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
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dependencies</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDependency}
                disabled={dependableEvents.length === 0}
              >
                + Add
              </Button>
            </div>
            {formData.dependsOn.length === 0 ? (
              <div className="text-xs text-neutral-500 italic">
                No dependencies. Add one to constrain when this event can be
                scheduled.
              </div>
            ) : (
              <div className="space-y-2">
                {formData.dependsOn.map((dep, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={dep.id}
                      onValueChange={(value) =>
                        updateDependency(idx, { id: value })
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {dependableEvents.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={dep.type}
                      onValueChange={(value) =>
                        updateDependency(idx, {
                          type: value as DependencyType,
                        })
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_DEP_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDependency(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between pt-4">
            <div>
              {mode === 'edit' && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    onDelete()
                    onClose()
                  }}
                >
                  Delete
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
