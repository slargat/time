import { toPlainDateString } from '@tanstack/time'
import type { DependencyType } from '@tanstack/time'
import { resourceDesign } from '@/data/samples'

export interface EventFormData {
  title: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  resourceId: string
  consumption: number
  dependsOn: Array<{ id: string; type: DependencyType }>
}

export const emptyFormData: EventFormData = {
  title: '',
  startDate: toPlainDateString(new Date()),
  startTime: '09:00',
  endDate: toPlainDateString(new Date()),
  endTime: '10:00',
  resourceId: resourceDesign.id,
  consumption: 1,
  dependsOn: [],
}
