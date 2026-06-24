import type { RecurrenceFrequency } from '@tanstack/time'
import { formatDateToISO } from '@/lib/dates'
import { sampleResources } from '@/data/samples'

export interface EventFormData {
  title: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  resourceId: string
  consumption: number
  recurrenceFrequency: RecurrenceFrequency | 'none'
  recurrenceUntil: string
}

export const emptyFormData: EventFormData = {
  title: '',
  startDate: formatDateToISO(new Date()),
  startTime: '09:00',
  endDate: formatDateToISO(new Date()),
  endTime: '10:00',
  resourceId: sampleResources[0]?.id ?? '',
  consumption: 1,
  recurrenceFrequency: 'none',
  recurrenceUntil: '',
}
