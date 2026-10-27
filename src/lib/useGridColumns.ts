import { useEffect, useRef, useState, type RefObject } from 'react'

const DESKTOP_QUERY = '(min-width: 1024px)'

/**
 * Page sizes per breakpoint: 14 on mobile (7 rows x 2 cols), 20 on desktop
 * (4 rows x 5 cols). Starts from the right value and tracks breakpoint changes.
 */
export function useResponsivePageSize(): { perPage: number; isDesktop: boolean } {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(DESKTOP_QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return { perPage: isDesktop ? 20 : 14, isDesktop }
}

/**
 * Report the current number of columns of a CSS grid (across breakpoints).
 * Used to keep an incremental grid's last row always full.
 */
export function useGridColumns(): {
  ref: RefObject<HTMLDivElement | null>
  cols: number
} {
  const ref = useRef<HTMLDivElement | null>(null)
  const [cols, setCols] = useState(2)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => {
      const n = getComputedStyle(el)
        .gridTemplateColumns.split(' ')
        .filter(Boolean).length
      if (n > 0) setCols(n)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, cols }
}