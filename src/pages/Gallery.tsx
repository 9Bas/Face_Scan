import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, Sparkles } from 'lucide-react'
import { listPublicAlbums, type PublicAlbum } from '../lib/galleryService'
import { categories, type Category } from '../data'
import AlbumCard from '../components/AlbumCard'
import { PageFade, Reveal, StaggerGrid, StaggerItem } from '../components/motion'

type FilterId = Category | 'all'

export default function Gallery() {
  const [allAlbums, setAllAlbums] = useState<PublicAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState<Set<FilterId>>(new Set(['all']))

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const alb = await listPublicAlbums()
      setAllAlbums(alb)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดอัลบั้มไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const toggle = (id: FilterId) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (id === 'all') {
        if (next.has('all') && next.size === 1) return next
        return new Set(['all'])
      }
      next.delete('all')
      if (next.has(id)) next.delete(id)
      else next.add(id)
      if (next.size === 0) next.add('all')
      return next
    })
  }

  const filtered = useMemo(() => {
    if (active.has('all') || active.size === 0) return allAlbums
    return allAlbums.filter((a) => a.category && active.has(a.category))
  }, [allAlbums, active])

  return (
    <PageFade>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Reveal className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
            <LayoutGrid size={15} />
            อัลบั้ม
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            แกลเลอรี่
          </h1>
          <p className="mt-2 text-slate-500">
            {loading
              ? 'กำลังโหลด…'
              : `${filtered.length} อัลบั้ม`}
          </p>
        </Reveal>

        {/* Category filter tabs */}
        {!loading && allAlbums.length > 0 && (
          <Reveal delay={0.05} className="mb-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-semibold text-slate-400">
                Filter:
              </span>
              {categories.map((cat) => {
                const isOn = active.has(cat.id)
                return (
                  <motion.button
                    key={cat.id}
                    type="button"
                    onClick={() => toggle(cat.id)}
                    whileTap={{ scale: 0.94 }}
                    className={[
                      'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                      isOn
                        ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {cat.label}
                  </motion.button>
                )
              })}
            </div>
          </Reveal>
        )}

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div
                  className="aspect-[4/3] bg-slate-100"
                  style={{
                    background:
                      'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'fs-shimmer 1.5s infinite',
                  }}
                />
                <div className="space-y-2 p-4">
                  <div
                    className="h-4 w-3/4 rounded"
                    style={{
                      background:
                        'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'fs-shimmer 1.5s infinite',
                    }}
                  />
                  <div
                    className="h-3 w-1/2 rounded"
                    style={{
                      background:
                        'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                      backgroundSize: '200% 100%',
                      animation: 'fs-shimmer 1.5s infinite',
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : filtered.length === 0 ? (
          // Empty state
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-20 text-center"
          >
            <span className="inline-flex rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
              <Sparkles size={28} className="text-brand-400" />
            </span>
            <p className="mt-4 text-base font-semibold text-slate-600">
              ยังไม่มีอัลบั้ม
            </p>
            <p className="mt-1 text-sm text-slate-400">
              อัลบั้มจากกิจกรรมจะแสดงที่นี่เมื่อช่างภาพอัปโหลด
            </p>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <StaggerGrid
              key={Array.from(active).sort().join(',')}
              className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            >
              {filtered.map((album) => (
                <StaggerItem key={album.id}>
                  <AlbumCard album={album} />
                </StaggerItem>
              ))}
            </StaggerGrid>
          </AnimatePresence>
        )}
      </div>

      {/* Inline keyframes for skeleton shimmer (avoids extra CSS file) */}
      <style>{`
        @keyframes fs-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </PageFade>
  )
}