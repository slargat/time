import { describe, expect, it, vi } from 'vitest'
import { monthViewFeature } from '../../features/month-view/month-view-feature'
import { functionalUpdate } from '../../utils'
import { constructCalendar } from './construct-calendar'
import type { ViewMode } from '../../types'

const WEEK: ViewMode = { value: 1, unit: 'week' }

describe('controlled state (v9 state / on<Slice>Change)', () => {
  it('uncontrolled: writes flow through the default handler into the store', () => {
    const calendar = constructCalendar({ features: { monthViewFeature }, events: [] })
    expect(calendar.store.state.viewMode.unit).toBe('month')

    calendar.changeViewMode(WEEK)
    expect(calendar.store.state.viewMode.unit).toBe('week')
  })

  it('controlled: changeViewMode routes to onViewModeChange, not the base atom', () => {
    const onViewModeChange = vi.fn()
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [],
      state: { viewMode: { value: 1, unit: 'month' } },
      onViewModeChange,
    })

    calendar.changeViewMode(WEEK)

    // The handler owns the write; the store stays at the controlled value until
    // the consumer pushes the new state back in.
    expect(onViewModeChange).toHaveBeenCalledWith(WEEK)
    expect(calendar.store.state.viewMode.unit).toBe('month')

    // Simulate the React loop: consumer updates its state → adapter setOptions.
    calendar.setOptions((prev) => ({ ...prev, state: { viewMode: WEEK } }))
    expect(calendar.store.state.viewMode.unit).toBe('week')
  })

  it('round-trips through a plain "useState" via functionalUpdate', () => {
    let external: ViewMode = { value: 1, unit: 'month' }
    const setViewMode = (updater: ViewMode | ((p: ViewMode) => ViewMode)) => {
      external = functionalUpdate(updater, external)
      calendar.setOptions((prev) => ({ ...prev, state: { viewMode: external } }))
    }
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [],
      state: { viewMode: external },
      onViewModeChange: setViewMode,
    })

    calendar.changeViewMode(WEEK)
    expect(external.unit).toBe('week')
    expect(calendar.store.state.viewMode.unit).toBe('week')
  })

  it('partial control: an uncontrolled slice still mutates internally', () => {
    const calendar = constructCalendar({
      features: { monthViewFeature },
      events: [],
      state: { viewMode: { value: 1, unit: 'month' } }, // only viewMode controlled
      onViewModeChange: vi.fn(),
    })

    const before = calendar.store.state.currentPeriod.toString()
    calendar.goToNextPeriod() // currentPeriod is uncontrolled
    expect(calendar.store.state.currentPeriod.toString()).not.toBe(before)
  })
})
