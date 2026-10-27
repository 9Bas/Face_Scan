import { useMemo } from 'react'

export default function WatermarkOverlay() {
  const text = 'FACE SCAN'

  const tiles = useMemo(() => {
    const count = 16
    return Array.from({ length: count })
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {tiles.map((_, i) => (
        <div
          key={i}
          className="absolute -rotate-[30deg] text-white/25 whitespace-nowrap text-sm sm:text-lg md:text-xl lg:text-2xl font-extrabold tracking-[0.5em] uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
          style={{
            left: `${(i % 4) * 25 - 12}%`,
            top: `${Math.floor(i / 4) * 25 - 12}%`,
          }}
        >
          {text}
        </div>
      ))}
    </div>
  )
}
