import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Images, ImageIcon, Plus } from 'lucide-react'
import { supabaseConfigured } from '../lib/supabaseClient'
import { useAuth } from '../auth'
import { albums as mockAlbums } from '../data'
import { listMyAlbums, type AlbumWithMeta } from '../lib/albumService'
import { storage } from '../lib/storage'
import StatsCard from '../components/dashboard/StatsCard'
import { PageFade } from '../components/motion'

interface OverviewStats {
  totalAlbums: number
  totalPhotos: number
  recentAlbums: AlbumWithMeta[]
}

const ease = [0.16, 1, 0.3, 1] as const

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      if (!user) {
        if (active) setLoading(false)
        return
      }
      try {
        const myAlbums = await listMyAlbums(user.id)
        const recent = myAlbums.slice(0, 4)
        if (!active) return
        setStats({
          totalAlbums: myAlbums.length,
          totalPhotos: myAlbums.reduce((n, a) => n + a.photo_count, 0),
          recentAlbums: recent,
        })
      } catch {
        // mock fallback
        if (active) {
          setStats({
            totalAlbums: mockAlbums.length,
            totalPhotos: mockAlbums.reduce((n, a) => n + a.photos.length, 0),
            recentAlbums: [],
          })
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [user])

  if (loading || !stats) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-400">
        กำลังโหลด…
      </div>
    )
  }

  return (
    <PageFade>
      {!supabaseConfigured && (
        <p className="mb-5 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
          ยังไม่ได้เชื่อม Supabase — แสดงข้อมูลตัวอย่าง (mock)
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          icon={<Images size={22} />}
          label="อัลบั้มทั้งหมด"
          value={stats.totalAlbums}
          delay={0}
        />
        <StatsCard
          icon={<ImageIcon size={22} />}
          label="รูปภาพทั้งหมด"
          value={stats.totalPhotos}
          delay={0.08}
        />
      </div>

      {/* Quick actions */}
      {/* Recent albums */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            อัลบั้มล่าสุด
          </h2>
          <Link
            to="/dashboard/albums"
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            ดูทั้งหมด →
          </Link>
        </div>

        {stats.recentAlbums.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <p className="text-slate-500">ยังไม่มีอัลบั้ม</p>
            <Link
              to="/dashboard/albums?action=new"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus size={16} />
              สร้างอัลบั้ม
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.recentAlbums.map((album, i) => (
              <motion.div
                key={album.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease }}
              >
                <Link
                  to={`/dashboard/albums/${album.id}`}
                  className="block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {album.cover_url ? (
                      <img
                        src={storage.getViewUrl(album.cover_url)}
                        alt={album.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <Images size={28} />
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm">
                      <Images size={11} className="text-brand-600" />
                      {album.photo_count} รูป
                    </span>
                  </div>
                  <p className="truncate p-3 text-sm font-semibold text-slate-900">
                    {album.name}
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </PageFade>
  )
}