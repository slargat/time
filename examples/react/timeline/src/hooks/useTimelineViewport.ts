import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

export function useTimelineViewport(ref: RefObject<HTMLDivElement | null>) {
  const [viewportWidth, setViewportWidth] = useState(0)

  useEffect(() => {
    const measure = () => {
      const el = ref.current
      if (el) setViewportWidth(el.clientWidth)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return viewportWidth
}
