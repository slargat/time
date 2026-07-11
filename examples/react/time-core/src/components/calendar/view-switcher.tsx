import { useSelector } from '@tanstack/react-store'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { useCalendarContext } from '../../lib/calendar'
import type { ViewMode } from '@tanstack/time-core'

/** The view options offered by the picker, in display order. */
const VIEW_MODES: Array<{ value: string; label: string; mode: ViewMode }> = [
  {
    value: 'timeline',
    label: 'Timeline',
    mode: { value: 1, unit: 'timeline' },
  },
  { value: 'month', label: 'Month', mode: { value: 1, unit: 'month' } },
  { value: 'week', label: 'Week', mode: { value: 1, unit: 'week' } },
  {
    value: 'workWeek',
    label: 'Work week',
    mode: { value: 1, unit: 'workWeek' },
  },
  { value: 'day', label: 'Day', mode: { value: 1, unit: 'day' } },
]
export function ViewSwitcher() {
  const calendar = useCalendarContext()
  const viewMode = useSelector(calendar.store, (state) => state.viewMode)
  return (
    <Select
      value={viewMode.unit}
      items={VIEW_MODES}
      onValueChange={(value) => {
        const next = VIEW_MODES.find((m) => m.value === value)
        if (next) calendar.changeViewMode(next.mode)
      }}
    >
      <SelectTrigger className="w-32" size="default">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="end">
        <SelectGroup>
          {VIEW_MODES.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
