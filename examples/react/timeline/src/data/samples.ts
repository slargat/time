import type { Event, Resource } from '@tanstack/time'

export const resourceDesign: Resource = {
  id: 'design',
  label: 'Design',
  availability: [
    { weekdays: [1, 2, 3, 4], startTime: '09:00', endTime: '17:00' },
    { weekdays: [5], startTime: '09:00', endTime: '13:00' },
  ],
}

export const resourceFrontend: Resource = {
  id: 'frontend',
  label: 'Frontend',
  availability: [
    { weekdays: [1, 2, 3, 4], startTime: '08:00', endTime: '24:00' },
    { weekdays: [5], startTime: '08:00', endTime: '24:00' },
  ],
}

export const resourceBackend: Resource = {
  id: 'backend',
  label: 'Backend',
  capacity: [2, 3, 5],
  availability: [
    { weekdays: [1, 2, 3], startTime: '10:00', endTime: '19:00' },
    { weekdays: [4, 5], startTime: '00:00', endTime: '24:00' },
  ],
}

export const resourceQA: Resource = {
  id: 'qa',
  label: 'QA',
  availability: [
    { weekdays: [1, 2, 3], startTime: '09:00', endTime: '17:00' },
    { weekdays: [4, 5], startTime: '10:00', endTime: '15:00' },
  ],
}

export const resourceDevOps: Resource = {
  id: 'devops',
  label: 'DevOps',
  availability: [
    { weekdays: [1, 2, 3, 4, 5], startTime: '07:00', endTime: '16:00' },
    { weekdays: [6, 7], startTime: '10:00', endTime: '14:00' },
  ],
}

export const sampleResources: Array<Resource> = [
  resourceDesign,
  resourceFrontend,
  resourceBackend,
  resourceQA,
  resourceDevOps,
]

function workWeekMonday(): Date {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)

  if (day === 0 || day === 6) {
    monday.setDate(today.getDate() + (day === 0 ? 1 : 2))
  } else {
    monday.setDate(today.getDate() + (1 - day))
  }
  monday.setHours(0, 0, 0, 0)
  return monday
}

function weekdayAt(
  isoWeekday: 1 | 2 | 3 | 4 | 5,
  hour: number,
  minute = 0,
): Date {
  const monday = workWeekMonday()
  const date = new Date(monday)
  date.setDate(monday.getDate() + isoWeekday - 1)
  date.setHours(hour, minute, 0, 0)
  return date
}

function getSampleEvents(): Array<Event<Resource>> {
  return [
    {
      id: '1',
      title: 'UI Mockups',
      start: weekdayAt(1, 10, 0),
      end: weekdayAt(1, 12, 30),
      resources: [resourceDesign],
    },
    {
      id: '2',
      title: 'Component Library',
      start: weekdayAt(2, 9, 0),
      end: weekdayAt(2, 17, 0),
      resources: [resourceFrontend],
      dependsOn: [{ id: '1', type: 'FS' }],
    },
    {
      id: '3',
      title: 'API Development',
      start: weekdayAt(2, 11, 0),
      end: weekdayAt(2, 18, 0),
      resources: [resourceBackend],
      consumption: [3],
      dependsOn: [{ id: '2', type: 'SS' }],
    },
    {
      id: '4',
      title: 'Database Schema',
      start: weekdayAt(1, 11, 0),
      end: weekdayAt(1, 16, 0),
      resources: [resourceBackend],
      consumption: [5],
    },
    {
      id: '5',
      title: 'Integration Tests',
      start: weekdayAt(3, 10, 0),
      end: weekdayAt(3, 15, 0),
      resources: [resourceQA],
      dependsOn: [{ id: '3', type: 'FF' }],
    },
    {
      id: '6',
      title: 'CI/CD Pipeline',
      start: weekdayAt(1, 8, 0),
      end: weekdayAt(1, 14, 0),
      resources: [resourceDevOps],
    },
    {
      id: '7',
      title: 'Design Review',
      start: weekdayAt(3, 10, 0),
      end: weekdayAt(3, 12, 30),
      resources: [resourceDesign],
    },
    {
      id: '8',
      title: 'Auth Module',
      start: weekdayAt(5, 6, 0),
      end: weekdayAt(5, 10, 0),
      resources: [resourceBackend],
    },
    {
      id: '9',
      title: 'Load Testing',
      start: weekdayAt(4, 10, 30),
      end: weekdayAt(4, 14, 30),
      resources: [resourceQA],
      dependsOn: [{ id: '4', type: 'SF' }],
    },
    {
      id: '10',
      title: 'Deployment',
      start: weekdayAt(5, 7, 30),
      end: weekdayAt(5, 13, 0),
      resources: [resourceDevOps],
      dependsOn: [{ id: '8', type: 'FS' }],
    },
  ]
}

export const MOCK_DB = getSampleEvents()
