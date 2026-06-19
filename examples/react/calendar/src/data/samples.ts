import type { Event, Resource } from '@tanstack/time'
import { dateTimeOnWeekday } from '@/lib/dates'

export const sampleResources: Array<Resource> = [
  {
    id: 'room-a',
    label: 'Room A',
    capacity: [4],
    availability: [
      {
        weekdays: [1, 2, 3, 4, 5],
        startTime: '08:00',
        endTime: '18:00',
      },
    ],
  },
  {
    id: 'room-b',
    label: 'Room B',
    capacity: [2],
    availability: [
      {
        weekdays: [1, 2, 3, 4, 5],
        startTime: '09:00',
        endTime: '18:00',
      },
    ],
  },
]

/*
  Capacity + consumption demo:
  - Room A has capacity 4, Room B has capacity 2.
  - Overlapping events intentionally consume different amounts.
  - Try resizing one event to overlap others to trigger capacity conflicts.
*/
export function getSampleEvents(): Array<Event<Resource>> {
  return [
    {
      id: '1',
      title: 'Team Meeting (A:2)',
      start: dateTimeOnWeekday(2, 12, 0),
      end: dateTimeOnWeekday(2, 13, 0),
      resources: [sampleResources[0]],
      consumption: [2],
    },
    {
      id: '2',
      title: 'Project Review (A:2)',
      start: dateTimeOnWeekday(3, 14, 0),
      end: dateTimeOnWeekday(3, 15, 30),
      resources: [sampleResources[0]],
      consumption: [2],
    },
    {
      id: '3',
      title: 'Workshop (B:1)',
      start: dateTimeOnWeekday(4, 12, 0),
      end: dateTimeOnWeekday(4, 16, 30),
      resources: [sampleResources[1]],
      consumption: [1],
    },
    {
      id: '4',
      title: 'Capacity Probe (A:1)',
      start: dateTimeOnWeekday(5, 12, 0),
      end: dateTimeOnWeekday(5, 13, 0),
      resources: [sampleResources[0]],
      consumption: [1],
    },
    {
      id: '5',
      title: 'Focus Block (A:2)',
      start: dateTimeOnWeekday(5, 12, 30),
      end: dateTimeOnWeekday(5, 14, 30),
      resources: [sampleResources[0]],
      consumption: [2],
    },
    {
      id: '6',
      title: 'Interview (B:1)',
      start: dateTimeOnWeekday(2, 12, 30),
      end: dateTimeOnWeekday(2, 14, 0),
      resources: [sampleResources[1]],
      consumption: [1],
    },
    {
      id: 'r-standup',
      title: '☀ Daily Stand-up (A:1)',
      start: dateTimeOnWeekday(1, 9, 0),
      end: dateTimeOnWeekday(1, 9, 15),
      resources: [sampleResources[0]],
      consumption: [1],
      recurrence: {
        frequency: 'daily',
        interval: 1,
        byWeekday: undefined,
      },
    },
    {
      id: 'r-sync',
      title: '🔄 Weekly Sync (B:1)',
      start: dateTimeOnWeekday(1, 10, 0),
      end: dateTimeOnWeekday(1, 10, 30),
      resources: [sampleResources[1]],
      consumption: [1],
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        byWeekday: [1],
      },
    },
    {
      id: 'r-report',
      title: '📊 Monthly Report (A:1)',
      start: dateTimeOnWeekday(1, 14, 0),
      end: dateTimeOnWeekday(1, 15, 0),
      resources: [sampleResources[0]],
      consumption: [1],
      recurrence: {
        frequency: 'monthly',
        interval: 1,
      },
    },
  ]
}

export const MOCK_DB = getSampleEvents()
