# @tanstack/time-core

🤖⏰ Headless, framework-agnostic calendar kernel for TanStack Time — feature-composed in the style of TanStack Table v9 `table-core`.

Runtime dependencies are only [`@tanstack/store`](https://tanstack.com/store) and
[`@js-temporal/polyfill`](https://github.com/js-temporal/temporal-polyfill).

## Concepts

- **Feature composition.** A calendar is `constructCalendar({ features, events })`.
  Features are plain objects keyed by name; an instance gains a feature's API only
  when that feature is registered (typed via declaration merging). Views are
  features too — `getView()` returns a `viewMode`-discriminated union of the
  registered views.
- **Two layers (ADR 0007).** An order-independent *composition* layer assigns
  methods/state; a kernel-ordered *pipeline* layer runs the read projection
  (`source → recurrenceExpand → clip → availabilityFilter → layout`) and the write
  pipeline (`recurrenceMaterialize → dependencyTransform → availabilityValidate →
  commit → undoSnapshot`) as single-owner stages.
- **Wall-time model.** Events are stored as zone-less wall-time strings
  (`YYYY-MM-DDTHH:mm:ss`). Absolute inputs (`Date`, epoch ms, `Z`/offset strings)
  are normalized into `options.timeZone` once, at ingestion.
- **Events ownership.** `options.events` seeds the collection; internal mutations
  (create/update/remove, resize, recurrence, dependency cascades) update it. Pass
  `onEventsChange` and re-feed a fresh `options.events` each render to control it
  (the v9 `data`/`onDataChange` pattern).

## Quick start

```ts
import {
  constructCalendar,
  monthViewFeature,
  eventCrudFeature,
} from '@tanstack/time-core'

const calendar = constructCalendar({
  features: { monthViewFeature, eventCrudFeature },
  events: [
    { id: '1', title: 'Standup', start: '2024-06-12T09:00', end: '2024-06-12T09:15' },
  ],
})

calendar.getView() // month view model
await calendar.createEvent({ id: '2', title: 'Review', start: '2024-06-12T14:00', end: '2024-06-12T15:00' })
```

Registering `resizeFeature`, `recurrenceFeature`, `dependenciesFeature`, or
`lazyFetchFeature` requires `eventCrudFeature` (the `commit` stage owner) for their
write paths; dispatching a write without it throws.

For React, use `@tanstack/react-time` (`useCalendar`) rather than driving the
kernel directly.
