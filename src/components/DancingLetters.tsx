import { LazyMotion, domAnimation, m } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

interface DancingLettersProps {
  text?: string
  className?: string
  letterClassName?: string
  letterStyle?: CSSProperties
  autoPlay?: boolean
  autoPlayInterval?: number
}

// Physics-based letter animations — each letter in the row gets one.
const letterAnimations = [
  {
    active: {
      scaleX: [1, 1.25, 0.75, 1.15, 0.95, 1.05, 1],
      scaleY: [1, 0.75, 1.25, 0.85, 1.05, 0.95, 1],
    },
    transition: { duration: 0.8, ease: 'easeInOut' as const },
    transformOrigin: 'center center',
  },
  {
    active: {
      rotate: [0, 80, 60, 80, 60, 0],
      y: [0, 10, -5, 5, -2, 0],
    },
    transition: { duration: 1.2, ease: [0.175, 0.885, 0.32, 1.275] },
    transformOrigin: 'bottom left',
  },
  {
    active: {
      scaleY: [1, 0.6, 1.2, 1],
      y: [0, 20, -40, 0],
    },
    transition: { duration: 0.6, ease: 'easeOut' as const },
    transformOrigin: 'bottom center',
  },
  {
    active: {
      rotateX: [0, 240, 150, 200, 175, 180, 180, 0],
      scale: [1, 1.1, 1],
    },
    transition: {
      duration: 2,
      ease: 'easeOut' as const,
      times: [0, 0.12, 0.24, 0.36, 0.48, 0.6, 0.85, 1],
    },
    transformOrigin: '50% 80%',
  },
  {
    active: { x: [0, -20, 15, -10, 5, 0] },
    transition: { duration: 0.8, ease: 'easeInOut' as const },
    transformOrigin: 'center center',
  },
  {
    active: {
      x: [0, -5, 5, -5, 5, -2, 2, 0],
      y: [0, -2, 2, -1, 1, 0],
      rotate: [0, -1, 1, -0.5, 0.5, 0],
    },
    transition: { duration: 0.5, ease: 'linear' as const },
    transformOrigin: 'center center',
  },
  {
    active: { scale: [1, 1.4, 1] },
    transition: { duration: 0.5, ease: 'easeInOut' as const },
    transformOrigin: 'center center',
  },
  {
    active: {
      y: [0, -30, 0],
      scale: [1, 1.1, 1],
      textShadow: [
        '0px 0px 0px rgba(0,0,0,0)',
        '0px 20px 20px rgba(0,0,0,0.2)',
        '0px 0px 0px rgba(0,0,0,0)',
      ],
    },
    transition: { duration: 1.2, ease: 'easeInOut' as const },
    transformOrigin: 'center center',
  },
]

/** Split into grapheme clusters so Thai vowels/tone marks don't detach. */
function graphemes(text: string): string[] {
  if (
    typeof Intl !== 'undefined' &&
    typeof Intl.Segmenter === 'function'
  ) {
    try {
      return Array.from(
        new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text),
        (s) => s.segment,
      )
    } catch {
      /* fall through to code points */
    }
  }
  return Array.from(text)
}

export default function DancingLetters({
  text = 'ANIMATE',
  className = '',
  letterClassName = '',
  letterStyle,
  autoPlay = true,
  autoPlayInterval = 2600,
}: DancingLettersProps) {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
  const letters = useMemo(() => graphemes(text), [text])

  const trigger = useCallback((index: number) => {
    setActiveKeys((prev) => new Set(prev).add(`${index}:${Date.now()}`))
  }, [])

  const handleClick = useCallback(
    (index: number) => {
      if (!letters[index].trim()) return
      setActiveKeys((prev) => {
        const next = new Set(prev)
        next.add(`${index}:${Date.now()}`)
        return next
      })
    },
    [letters],
  )

  const handleAnimationComplete = useCallback((key: string) => {
    setActiveKeys((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  useEffect(() => {
    if (!autoPlay || letters.length <= 1) return
    const id = setInterval(() => {
      const candidates = letters
        .map((l, i) => ({ l, i }))
        .filter((x) => x.l.trim() !== '')
      if (!candidates.length) return
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      trigger(pick.i)
    }, autoPlayInterval)
    return () => clearInterval(id)
  }, [autoPlay, autoPlayInterval, letters, trigger])

  const rootClass = [
    'inline-flex items-center justify-center select-none',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <LazyMotion features={domAnimation}>
      <m.span
        className={rootClass}
        style={{ perspective: '1000px' }}
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0, y: 20 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { staggerChildren: 0.05 },
          },
        }}
      >
        {letters.map((letter, id) => {
          const anim = letterAnimations[id % letterAnimations.length]
          const key = [...activeKeys].find((k) => k.startsWith(`${id}:`))
          const isActive = key !== undefined
          const letterClass = [
            'relative inline-block cursor-pointer',
            letterClassName,
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <m.span
              key={`${letter}-${id}`}
              variants={{
                hidden: { opacity: 0, y: 20, scale: 0.8 },
                visible: {
                  opacity: 1,
                  scale: 1,
                  x: 0,
                  y: 0,
                  rotate: 0,
                  rotateX: 0,
                  rotateY: 0,
                  scaleX: 1,
                  scaleY: 1,
                  textShadow: '0px 0px 0px rgba(0,0,0,0)',
                  transition: { type: 'spring', stiffness: 300, damping: 20 },
                },
                active: {
                  ...anim.active,
                  opacity: 1,
                  // @ts-expect-error framer-motion variant transition typing
                  transition: anim.transition,
                },
              }}
              animate={isActive ? 'active' : 'visible'}
              onHoverStart={() => !letter.trim() || handleClick(id)}
              onClick={() => handleClick(id)}
              onAnimationComplete={(definition) => {
                if (definition === 'active' && key) {
                  handleAnimationComplete(key)
                }
              }}
              className={letterClass}
              style={{
                transformOrigin: anim.transformOrigin,
                transformStyle: 'preserve-3d',
                ...letterStyle,
              }}
            >
              {letter.trim() ? letter : '\u00A0'}
            </m.span>
          )
        })}
      </m.span>
    </LazyMotion>
  )
}