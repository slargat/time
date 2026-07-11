import type { CalendarFeature } from '../types/calendar-features'

/**
 * Collect single-owner stage fns from the registered features and return them in
 * the kernel-fixed order. Throws if two features fill the same stage (Q8: stages
 * are single-owner — split a contended stage rather than add priority).
 */
export function assembleStages<TStage extends string, TFn>(
  features: Array<CalendarFeature>,
  slot: 'projection' | 'write',
  order: ReadonlyArray<TStage>,
): Array<{ stage: TStage; fn: TFn }> {
  const owner = new Map<TStage, TFn>()
  for (const feature of features) {
    const fns = feature[slot] as Partial<Record<TStage, TFn>> | undefined
    if (!fns) continue
    for (const stage of Object.keys(fns) as Array<TStage>) {
      if (owner.has(stage)) {
        throw new Error(
          `[time-core] two features fill the "${slot}.${stage}" stage. Stages are single-owner — split the stage instead of contending for it.`,
        )
      }
      owner.set(stage, fns[stage] as TFn)
    }
  }
  return order
    .filter((stage) => owner.has(stage))
    .map((stage) => ({ stage, fn: owner.get(stage)! }))
}
