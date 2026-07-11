import { coreFeatures } from '../core-features'
import { storeReactivityBindings } from '../../store-reactivity-bindings'
import { atomToStore } from '../reactivity/core-reactivity.utils'
import { assembleStages } from '../../pipeline/assemble'
import {
  PROJECTION_STAGE_ORDER,
  WRITE_STAGE_ORDER,
} from '../../pipeline/stages'
import {
  calendar_setOptions,
  calendar_syncExternalStateToBaseAtoms,
} from './calendar-options.utils'
import type {
  ProjectionStage,
  ProjectionStageFn,
  WriteStage,
  WriteStageFn,
} from '../../pipeline/stages'
import type {
  CalendarFeature,
  CalendarFeatures,
  CalendarView,
} from '../../types/calendar-features'
import type {
  Calendar,
  CalendarOptions,
  Calendar_Internal,
} from '../../types/calendar'
import type { CalendarStore, Event, Resource } from '../../types'

/**
 * Build a calendar instance from opt-in features, mirroring v9 `constructTable`.
 *
 * Two distinct layers (ADR 0007):
 *  - COMPOSITION (registration order): `constructCalendarApis` + shared node
 *    prototypes assign methods/state. Order-independent.
 *  - PIPELINE (kernel-fixed order): `projection`/`write` stage fns are assembled
 *    into ordered, single-owner chains (ADR 0001).
 *
 * Reactivity follows v9: per-state-key writable `baseAtoms`, readonly `atoms`,
 * and a derived read-only `store`. The reactivity binding comes from the adapter
 * via `features.coreReactivityFeature`, defaulting to the vanilla
 * `storeReactivityBindings` so the kernel constructs standalone.
 */
export function constructCalendar<
  TFeatures extends CalendarFeatures,
  TResource extends Resource = Resource,
  TEvent extends Event<TResource> = Event<TResource>,
>(
  options: CalendarOptions<TFeatures, TResource, TEvent>,
): Calendar<TFeatures, TResource, TEvent> {
  const optionFeatures = options.features as unknown as Record<
    string,
    CalendarFeature
  > & { coreReactivityFeature?: ReturnType<typeof storeReactivityBindings> }

  const { coreReactivityFeature, ...userFeatures } = optionFeatures
  const _reactivity = coreReactivityFeature ?? storeReactivityBindings()

  const features: Record<string, CalendarFeature> = {
    ...coreFeatures,
    ...userFeatures,
  }
  const featureList = Object.values(features)

  const calendar = {
    _reactivity,
    _features: features,
    _eventPrototype: {},
    _dayPrototype: {},
    baseAtoms: {},
    atoms: {},
    options,
  } as unknown as Calendar_Internal<TFeatures, TResource, TEvent>

  // default options (user options win)
  const defaultOptions = featureList.reduce(
    (acc, feature) => Object.assign(acc, feature.getDefaultOptions?.(calendar)),
    {} as Partial<CalendarOptions<TFeatures, TResource, TEvent>>,
  )
  calendar.options = { ...defaultOptions, ...options }

  // initial state — each feature contributes defaults; user initialState wins last
  let initialState: Partial<CalendarStore> = { ...options.initialState }
  for (const feature of featureList) {
    initialState = feature.getInitialState?.(initialState) ?? initialState
  }
  calendar.initialState = initialState as CalendarStore

  // per-state-key atoms + derived read-only store (v9 reactivity)
  const stateKeys = Object.keys(calendar.initialState)
  for (const key of stateKeys) {
    calendar.baseAtoms[key] = _reactivity.createWritableAtom(
      (calendar.initialState as unknown as Record<string, unknown>)[key],
      { debugName: `calendar/baseAtoms/${key}` },
    )
    // Read precedence: external `options.atoms[key]` > internal base atom
    // (v9). External atoms let an app own a slice end-to-end.
    calendar.atoms[key] = _reactivity.createReadonlyAtom(
      () => {
        const externalAtom = (
          calendar.options.atoms as Record<string, { get: () => unknown }> | undefined
        )?.[key]
        return externalAtom ? externalAtom.get() : calendar.baseAtoms[key]!.get()
      },
      { debugName: `calendar/atoms/${key}` },
    )
  }
  // Reflect any controlled `options.state` into the base atoms before derived
  // reads (store / view) run.
  calendar_syncExternalStateToBaseAtoms(calendar)
  calendar.store = atomToStore(
    _reactivity.createReadonlyAtom(
      () => {
        const snapshot = {} as Record<string, unknown>
        for (const key of stateKeys) snapshot[key] = calendar.atoms[key]!.get()
        return snapshot as unknown as CalendarStore
      },
      { debugName: 'calendar/store' },
    ),
  )

  // composition layer: singleton APIs (core first, so store/options exist)
  for (const feature of featureList) feature.constructCalendarApis?.(calendar)

  // composition layer: shared node prototypes (v9 assign*Prototype)
  for (const feature of featureList) {
    feature.assignEventPrototype?.(calendar._eventPrototype, calendar)
    feature.assignDayPrototype?.(calendar._dayPrototype, calendar)
  }

  // pipeline layer: kernel-ordered, single-owner stages (ADR 0001/0007)
  calendar._projection = assembleStages<ProjectionStage, ProjectionStageFn>(
    featureList,
    'projection',
    PROJECTION_STAGE_ORDER,
  )
  calendar._write = assembleStages<WriteStage, WriteStageFn>(
    featureList,
    'write',
    WRITE_STAGE_ORDER,
  )

  // registered views (the active one is dispatched by coreViewModelsFeature)
  calendar._views = featureList
    .map((feature) => feature.view)
    .filter((view): view is CalendarView => Boolean(view))

  calendar.setOptions = (updater) => calendar_setOptions(calendar, updater)

  calendar.destroy = () => {
    for (const feature of featureList) feature.destroy?.(calendar)
    _reactivity.unmount?.()
  }

  return calendar as unknown as Calendar<TFeatures, TResource, TEvent>
}
