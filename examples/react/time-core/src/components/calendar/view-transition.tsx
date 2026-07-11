import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Temporal } from '@js-temporal/polyfill'
import type { ViewMode } from '@tanstack/time-core'

type Direction = 'future' | 'past' | 'neutral'

/**
 * Direction-aware enter animation for the active view panel.
 *
 * Keyed on `currentPeriod` + `viewMode` so the panel remounts (replaying the CSS
 * keyframe) whenever either changes. Direction is the sign of the period delta
 * vs. the previously-rendered period: future → slide in from the right, past →
 * from the left, a view-mode switch (same period) → a neutral fade. The
 * reduced-motion fallback (in index.css) collapses all three to a plain fade.
 *
 * Direction is tracked via the "adjust state during render" pattern rather than
 * a ref mutated in render — the latter isn't idempotent under StrictMode's
 * double render and collapses every navigation to `neutral`.
 */
export function ViewTransition({
  currentPeriod,
  viewMode,
  children,
}: {
  currentPeriod: Temporal.PlainDate
  viewMode: ViewMode
  children: ReactNode
}) {
  const periodKey = currentPeriod.toString()
  const fullKey = `${periodKey}|${viewMode.value}${viewMode.unit}`

  const [seen, setSeen] = useState<{
    periodKey: string
    date: Temporal.PlainDate
    fullKey: string
    direction: Direction
  }>({ periodKey, date: currentPeriod, fullKey, direction: 'neutral' })

  if (seen.fullKey !== fullKey) {
    // Same period (view-mode switch) → neutral fade; otherwise sign of the delta.
    const sign =
      periodKey === seen.periodKey ? 0 : currentPeriod.since(seen.date).sign
    setSeen({
      periodKey,
      date: currentPeriod,
      fullKey,
      direction: sign > 0 ? 'future' : sign < 0 ? 'past' : 'neutral',
    })
  }

  return (
    <div
      key={fullKey}
      data-direction={seen.direction}
      className="view-transition flex min-h-0 flex-1 flex-col"
    >
      {children}
    </div>
  )
}
