import type { CalendarFeatures } from './calendar-features'
import type { Event, Resource } from '../types'

/**
 * Maps each registered View-feature key to the view model its `build` produces.
 * View features declaration-merge their entry here (see
 * `features/month-view/monthViewFeature.types.ts`).
 *
 * `getView()` returns the `viewMode`-discriminated UNION of the registered views
 * (not the intersection used for feature APIs) — exactly one view is active.
 */
export interface ViewModel_FeatureMap<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> {
  /** phantom: keeps generics in use; never matches a feature key. */
  readonly '~viewModel'?: [TFeatures, TResource, TEvent]
}

/** The union of view models for the registered views; `never` until one is registered. */
export type ActiveViewModel<
  TFeatures extends CalendarFeatures,
  TResource extends Resource,
  TEvent extends Event<TResource>,
> = ViewModel_FeatureMap<TFeatures, TResource, TEvent>[Extract<
  keyof TFeatures,
  keyof ViewModel_FeatureMap<TFeatures, TResource, TEvent>
>]
