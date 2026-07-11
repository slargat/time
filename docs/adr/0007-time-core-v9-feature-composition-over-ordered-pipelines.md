# `time-core`: v9-style feature composition layered over ADR 0001's ordered pipelines

## Status

accepted (amends [ADR 0001](./0001-one-kernel-modules-as-pipeline-stages.md))

## Context

The calendar kernel was being built in `packages/time/src/calendar` as a feature-plugin system
that *named* TanStack Table v9 but drifted from it: cross-feature wiring went through
`as unknown as { _internal }` casts, node methods were hung on shared mutable prototypes
(`Object.create(calendar._eventPrototype)`), and the ordered pipelines ADR 0001 accepted were
never actually implemented (recurrence-expand + clip happen inline in `eventsFeature`). At the
same time the 3,869-line `calendar.ts` god class still ships alongside it.

We want a clean kernel that *structurally* follows v9 `table-core` (its real composition,
typing, and reactivity machinery), salvages the pure functions (`expandRecurringEvent`,
`splitMultiDayEvents`, `getEventProps`, `getTimeSlots`, `groupDaysBy`, `resizeController`, …),
and honors ADR 0001's ordering guarantees instead of paying lip service to them.

## Decision

Build a **new package `@tanstack/time-core`** as a **parallel implementation** — both it and the
existing `@tanstack/time` calendar ship until time-core reaches parity, then consumers flip over
and the old `calendar/` is deleted.

- **Self-contained.** Runtime deps are only `@tanstack/store` and `@js-temporal/polyfill`. The
  pure functions and the date helpers they need are **copied in** (no dependency on
  `@tanstack/time`).
- **Three core entities** the kernel constructs and features extend via `construct<Entity>APIs`:
  **Calendar**, **Day**, **Event** (the analogue of v9 table/row/cell). Week/TimeSlot/Lane/Group
  are **output shapes** of a view model, not feature-extensible entities.
- **Views are features.** A view is a `CalendarFeature` carrying a `view: { matches, build }`
  descriptor; `matches(viewMode)` selects the active view, `build` produces its **view model**.
  Only the active view is built. `getView()` returns a `viewMode`-**discriminated union** of the
  registered views (narrow with `switch`) — a *union*, unlike the *intersection* used for feature
  APIs, because exactly one view is active. Unused views tree-shake.
- **v9 mechanisms throughout**, replacing the drift: per-entity `assign{Calendar,Day,Event}APIs`
  with `{ fn, memoDeps }` memoization (kills the shared-prototype hack), namespaced static
  functions (`calendar_*` / `day_*` / `event_*`) for tree-shakeable cross-feature access (kills
  the `as unknown as` casts), and `.types.ts` declaration-merging for typed inference (a `getX`
  exists only when feature `X` is registered).
- **Two layers, kept distinct (this is the amendment to ADR 0001):**
  1. **Composition layer** — features assemble in registration (object-key) order to *assign*
     methods/state. Order is irrelevant here because assignment doesn't transform another
     feature's data. This is pure v9.
  2. **Pipeline layer** — the read **projection** (`source → recurrence-expand → clip-to-viewport
     → availability-filter → layout`, where the active View is the `layout` tail) and the
     **write** path (`recurrence-materialize → dependency-transform → availability-validate →
     commit → undo-snapshot`) remain **kernel-defined ordered stages**. Features register *into*
     named stages; the kernel fixes stage order. This preserves ADR 0001 verbatim.

  The read projection *is* v9's row-model pipeline applied to occurrences, so it is maximally
  on-target. The write pipeline has no v9 analogue (tables don't cascade writes) and is the one
  place the calendar genuinely exceeds the table model.

## Considered Options

- **Refactor in place / fat core / pure-v9 (drop ordered pipelines).** Rejected:
  - Refactoring in place keeps the god class and the drifted wiring entangled with the rebuild.
  - A pure-v9 registration-order model re-opens the exact ordering footgun ADR 0001 rejected —
    the room-at-capacity recurring-occurrence-with-a-dependent write-cascade has one correct order
    that registration order can't guarantee. Tables never face this; calendars do.
- **A separate `views: {}` registry** parallel to `features: {}`. Rejected: a second composition
  system (second hook set, second inference chain) for zero new capability — the feature
  mechanism already gives opt-in, tree-shaking, state, and typed APIs.
- **A literal v9 row-model factory for views** (`monthView: getMonthViewModel()`). Rejected:
  v9 row models *compose into a pipeline*; calendar views are *mutually exclusive* per viewMode,
  so the pipeline machinery would be inherited and unused. The `view` descriptor models what
  views actually are.

## Consequences

- ADR 0001 stays in force; this ADR only clarifies how its ordered pipelines coexist with v9
  feature composition (they are different layers).
- Two calendar implementations live at once during the parallel phase; the old `calendar/` and
  the `calendar.ts` god class are deleted only after parity.
- Cross-feature extension of a view's *output shape* (e.g. availability annotating a TimeSlot)
  is **deferred** — the single-registry version ships first; the multi-registry mechanism is the
  documented upgrade path, added when a real third-party need appears.
- The kernel must enumerate projection/write stages up front (as ADR 0001 already required),
  bounding what a third-party feature can do — acceptable for this domain.
