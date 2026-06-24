import type { Day, Event, Resource } from './types'
import { isWeekend } from '~/date'

/** Framework-neutral structural attributes for a calendar day cell. */
export interface DayCellAttributes {
  'data-iso': string
  'data-today': boolean
  'data-in-period': boolean
  'data-weekend': boolean
}

export interface BuildDayCellAttributesOptions {
  locale?: string
}

/**
 * Builds the structural `data-*` attributes for a calendar day cell from a
 * {@link Day}. Pure and framework-agnostic; framework adapters compose these
 * with keys, refs and event handlers.
 */
export const buildDayCellAttributes = <
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(
  day: Day<TResource, TEvent>,
  options?: BuildDayCellAttributesOptions,
): DayCellAttributes => ({
  'data-iso': day.isoDate,
  'data-today': day.isToday,
  'data-in-period': day.isInCurrentPeriod,
  'data-weekend': isWeekend(day.isoDate, { locale: options?.locale }),
})
