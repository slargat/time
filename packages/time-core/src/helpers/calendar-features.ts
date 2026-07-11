import type {
  CalendarFeatures,
  ValidateFeatureSlots,
} from '../types/calendar-features'

/**
 * Identity helper for defining a calendar's opt-in feature set with correct type
 * inference (mirrors v9 `tableFeatures`). Passing the features through it
 * validates {@link ValidateFeatureSlots} — e.g. a feature that requires a peer
 * (`resizeFeature` needs `eventCrudFeature`) becomes a compile error if the peer
 * is missing. Use it statically, outside any component.
 *
 * @example
 * ```ts
 * import {
 *   calendarFeatures,
 *   eventCrudFeature,
 *   monthViewFeature,
 *   resizeFeature,
 * } from '@tanstack/time-core'
 *
 * const features = calendarFeatures({
 *   monthViewFeature,
 *   eventCrudFeature,
 *   resizeFeature, // requires eventCrudFeature — enforced at compile time
 * })
 * const calendar = constructCalendar({ features, events })
 * ```
 */
export function calendarFeatures<TFeatures extends CalendarFeatures>(
  features: TFeatures & ValidateFeatureSlots<TFeatures>,
): TFeatures {
  return features
}
