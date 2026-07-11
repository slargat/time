# time-core fix plan (from grilling, 2026-07-11)

Full-sweep correctness pass over `packages/time-core`. All 4 HIGH + 5 MEDIUM +
LOW cleanup, plus a ported behavioral test suite. Decisions locked below; phases
are ordered by dependency.

## Decisions

1. **Scope:** everything (HIGH + MEDIUM + LOW).
2. **Date contract:** normalize absolute inputs (Date/epoch/offset-string) to
   wall-time strings **once on ingestion**, using `options.timeZone` at ingestion
   time. Wall-time strings taken literally; captured `Z`/offset honored (converted
   into `options.timeZone`). A later `timeZone` change does **not** retro-convert
   stored wall-times.
3. **Event ownership:** v9 dual controlled/uncontrolled. `options.events` seeds
   internal state as INITIAL; internal mutations update it; `state.events` +
   `onEventsChange` makes it controlled (re-synced every `setOptions`).
4. **Events representation:** move the collection into the store as a real state
   atom; projection memos key off the array reference; **delete `eventsVersion`
   and `onEventsVersionChange`** (one invalidation mechanism).
5. **Config invalidation:** put option values (`timeZone`, `weekStartsOn`,
   `locale`, `resources`) in each memo's `memoDeps`; clear the 3 availability
   caches in `setOptions` on `resources` identity change; push `timeZone` to the
   resize controller on change. No new state atom (React-only v1, ADR 0005).
6. **Commit guard:** BOTH a runtime throw at construction (write stages present,
   no `commit` owner) AND type-level `FeatureSlotPrereqs` (recurrence/
   dependencies/resize require `eventCrudFeature`).
7. **Lazy-fetch rollback:** separate `inFlight` (exact, un-merged) from
   `loadedRanges` (merged, success-only). Dedup checks the union; success moves
   inFlight→loaded (merge); failure removes the exact inFlight entry only.
8. **Recurrence:** full iCal correctness — `until` INCLUSIVE (update doc),
   bounded override look-ahead past `windowEnd`, seek starting step to
   `windowStart` (kills silent `MAX_STEPS` truncation).
9. **DST cascade:** apply the dependency shift in the **instant** domain
   (`toZonedDateTime(tz)` → add/subtract ms → back), preserving the real-time
   relationship the FS/SS/FF/SF constraint encodes.
10. **Split invariant:** a projected event stays a WHOLE event; splitting stays
    layout-time. Fix `computeEventProps` to read the segment's own
    `_originalStart/_originalEnd`; wrap timeline lane events in `constructEvent`.
11. **Tests:** per-fix red/green tests + port the old `time` behavioral suite
    (dependency cascades, capacity, recurrence editing) to the feature-composed
    API + a `date-utils` parsing table.
12. **Example/verify:** exercise only new capability (controlled events,
    `setEvents`) in `examples/react/time-core`; gate on the example
    `tsc --noEmit && vite build` + full `vitest`.

## Phases

**P0 — Canonical date coercion (foundational).** `normalizeEvent(event, tz)`
coerces `start`/`end` (+ recurrence override/exDate inputs) to wall-time strings.
`toPlainDate` derives from `toPlainDateTimeString`; internal helpers become
string-only. Honor offsets; convert absolute inputs via `tz`.
Files: `date-utils.ts`, new `normalize-event.ts`.

**P1 — Events as state.** Add `events` state slice; seed from `options.events`
via `normalizeEvent`; controlled path through `syncExternalStateToBaseAtoms`;
internal mutations set the atom; add imperative `setEvents`. Delete
`eventsVersion`/`onEventsVersionChange`; update memoDeps in
`core-days-feature.ts`, `core-view-models-feature.ts`,
`core-projection-feature.utils.ts`, and `dispatch-write`'s commit.

**P2 — setOptions invalidation.** `calendar_setOptions`: diff options; clear
availability caches on `resources` change; push `timeZone` to resize controller;
resize feature reads `timeZone` live (stop capturing at construction). Add option
values to memoDeps.

**P3 — Commit guard.** Runtime throw in `constructCalendar` after `assembleStages`;
populate `FeatureSlotPrereqs`.

**P4 — Lazy-fetch rollback.** `inFlight` set in `LazyFetchState`; rework
`isRangeLoaded`/`runFetch`/rollback. **Flag:** lazy-fetch merges should bypass
undo snapshots (server state, not user edits) — confirm during impl.

**P5 — Recurrence edges.** `until` inclusive; override look-ahead margin; seek to
`windowStart`. Update `RecurrenceRule` JSDoc in `types.ts`.

**P6 — DST cascade.** Instant-domain shift in `propagateStartDeltaBackward`,
`propagateEndDelta`, and the inline cascade paths.

**P7 — Split/layout consumers.** `computeEventProps` reads
`_originalStart/_originalEnd`; `timelineView_build` wraps lane events in
`constructEvent`.

**P8 — LOW cleanup.** `isToday`: document limitation + ponytail comment (no
midnight timer). Delete dead code: `Resource.buffer`, `Prettify`, duplicate
`Updater`, unwired `day_getEvents`/`day_getAllDayEvents`, dead bindings methods,
stray TanStack **Table** JSDoc + commented test in `helpers/calendar-features.ts`.
`ViewMode.unit` `'agenda'`: remove or guard. Optional history-stack cap. Expand
README.

**P9 — Tests.** Per-fix suites (lazy-fetch retry, setOptions re-sync, DST instant,
`until` inclusive, `isSplitEvent`, commit-guard throw, date-utils parsing table);
then port `time`'s behavioral suite adapted to the composed API.

**P10 — Example + verify.** Add controlled-events (`state.events`+`onEventsChange`)
and `setEvents` usage to `examples/react/time-core`. Gate:
`cd examples/react/time-core && pnpm exec tsc --noEmit -p tsconfig.json && pnpm exec vite build`
+ `pnpm --filter @tanstack/time-core test`.
