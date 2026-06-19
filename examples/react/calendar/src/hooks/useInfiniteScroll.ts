import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

interface useInfiniteScrollProps<T extends Element> {
  root: RefObject<T | null>
  rootMargin?: string
  cooldownMs?: number
  onReachStart?: () => void
  onReachEnd?: () => void
  disabled?: boolean
}

export function useInfiniteScroll<T extends Element = HTMLElement>(
  props: useInfiniteScrollProps<T>,
): {
  startSentinelRef: RefObject<HTMLDivElement | null>
  endSentinelRef: RefObject<HTMLDivElement | null>
} {
  const {
    root,
    rootMargin = '0px',
    cooldownMs = 0,
    onReachStart,
    onReachEnd,
    disabled = false,
  } = props

  const startSentinelRef = useRef<HTMLDivElement | null>(null)
  const endSentinelRef = useRef<HTMLDivElement | null>(null)

  const onReachStartRef = useRef(onReachStart)
  const onReachEndRef = useRef(onReachEnd)
  onReachStartRef.current = onReachStart
  onReachEndRef.current = onReachEnd

  useEffect(() => {
    if (disabled) return
    const rootEl = root.current
    const startEl = startSentinelRef.current
    const endEl = endSentinelRef.current
    if (!rootEl || (!startEl && !endEl)) return

    let startCooldownUntil = 0
    let endCooldownUntil = 0

    const observer = new IntersectionObserver(
      (entries) => {
        const now = performance.now()
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          if (entry.target === startEl && now >= startCooldownUntil) {
            startCooldownUntil = now + cooldownMs
            onReachStartRef.current?.()
          } else if (entry.target === endEl && now >= endCooldownUntil) {
            endCooldownUntil = now + cooldownMs
            onReachEndRef.current?.()
          }
        }
      },
      { root: rootEl, rootMargin, threshold: 0 },
    )

    if (startEl) observer.observe(startEl)
    if (endEl) observer.observe(endEl)

    return () => observer.disconnect()
  }, [root, rootMargin, cooldownMs, disabled])

  return { startSentinelRef, endSentinelRef }
}
