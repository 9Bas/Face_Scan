import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase, supabaseConfigured } from '../lib/supabaseClient'
import { albums as mockAlbums } from '../data'

const headingLines = ['ค้นหาภาพของคุณ', 'ด้วย Face AI']
const subtext =
  'แกลเลอรี่รวมภาพกิจกรรม อัพโหลดรูปตัวเองแล้วให้ AI ช่วยหาภาพของคุณจากกิจกรรม'

// ── palette from the example (exact hex) ──────────────────
const colors = {
  greenDeep: '#1B5E20',
  greenMid: '#2E7D32',
  greenVivid: '#43A047',
  greenLight: '#A5D6A7',
  greenGlow: '#69F0AE',
  offWhite: '#F8FAF8',
  textDark: '#1A2A1A',
  textMuted: '#7A9A7A',
}

export default function Home() {
  const [stats, setStats] = useState<{ photos: number; events: number }>({
    photos: 0,
    events: 0,
  })

  useEffect(() => {
    let active = true
    async function loadStats() {
      if (!supabaseConfigured || !supabase) {
        if (active) {
          setStats({
            photos: mockAlbums.reduce((n, a) => n + a.photos.length, 0),
            events: mockAlbums.length,
          })
        }
        return
      }
      const sb = supabase as NonNullable<typeof supabase>
      try {
        const [alb, pho] = await Promise.all([
          sb.from('albums').select('id', { count: 'exact', head: true }),
          sb.from('photos').select('id', { count: 'exact', head: true }),
        ])
        if (!active) return
        setStats({ photos: pho.count ?? 0, events: alb.count ?? 0 })
      } catch {
        /* keep zeros */
      }
    }
    void loadStats()
    return () => {
      active = false
    }
  }, [])

  const statsList = [
    { value: stats.photos.toLocaleString(), label: 'ภาพทั้งหมด' },
    { value: stats.events.toLocaleString(), label: 'กิจกรรม' },
  ]

  return (
    <div
      className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-6 py-16"
      style={{ backgroundColor: colors.offWhite }}
    >
      {/* ── Animated expanding rings ────────────────────── */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[300, 500, 700, 900].map((size, i) => (
          <motion.div
            key={size}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              border: `1px solid rgba(67,160,71,0.12)`,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.9, 1, 0.9],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 1.5,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* ── Badge ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
          style={{
            background:
              'linear-gradient(135deg, rgba(105,240,174,0.15), rgba(67,160,71,0.1))',
            borderColor: 'rgba(67,160,71,0.3)',
            color: colors.greenMid,
          }}
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: colors.greenVivid }}
          />
          ระบบค้นหาภาพด้วย AI
        </motion.div>

        {/* ── Title ──────────────────────────────────────── */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl"
          style={{ color: colors.textDark }}
        >
          {headingLines.map((line, li) => (
            <span key={li} className="block">
              {li === 1 ? (
                <>
                  ด้วย{' '}
                  <span
                    style={{
                      background: `linear-gradient(135deg, ${colors.greenVivid}, ${colors.greenDeep})`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Face AI
                  </span>
                </>
              ) : (
                line
              )}
            </span>
          ))}
        </motion.h1>

        {/* ── Subtitle ───────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
          className="mt-5 max-w-xl text-base font-light leading-relaxed sm:text-lg"
          style={{ color: colors.textMuted }}
        >
          {subtext}
        </motion.p>

        {/* ── Stats ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45, ease: 'easeOut' }}
          className="mt-16 flex items-center gap-12"
        >
          {statsList.map((s, i) => (
            <div
              key={s.label}
              className="text-center"
              style={
                i < statsList.length - 1
                  ? { borderRight: '1px solid rgba(122,154,122,0.25)', paddingRight: '3rem' }
                  : {}
              }
            >
              <div
                className="text-3xl font-bold sm:text-4xl"
                style={{ color: colors.greenDeep }}
              >
                {s.value}
              </div>
              <div
                className="mt-0.5 text-sm"
                style={{ color: colors.textMuted }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── Footer credit ──────────────────────────────── 
      <div
        className="absolute bottom-0 left-0 right-0 py-2.5 text-center"
        style={{ color: 'rgba(255,255,255,0.35)', background: colors.textDark }}
      >
        <span className="text-[11px] font-light tracking-wide">
          พัฒนาโดยนักศึกษา{' '}
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>
            มหาวิทยาลัยราชภัฏพิบูลสงคราม
          </span>{' '}
          · Face Search Gallery 2025
        </span>
      </div>*/}
    </div>
  )
}