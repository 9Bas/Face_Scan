import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Images,
  Loader2,
  MapPin,
  ScanFace,
} from 'lucide-react'
import {
  getPublicAlbum,
  listAlbumPhotos,
  type PublicAlbum,
  type PublicPhoto,
} from '../lib/galleryService'
import ImageCard from '../components/ImageCard'
import ImageViewer from '../components/ImageViewer'
import FaceSearchModal from '../components/FaceSearchModal'
import { PageFade } from '../components/motion'
import { useGridColumns, useResponsivePageSize } from '../lib/useGridColumns'
import { type Photo } from '../data'
import { formatDateThai } from '../lib/date'
import { useAuth } from '../auth'

/** Map a DB photo row to the UI Photo shape, preferring the thumbnail. */
function toPhoto(p: PublicPhoto): Photo {
  return {
    id: p.id,
    url: p.url,
    thumb: p.thumb_url ?? p.url,
    title: p.filename,
    width: p.width ?? 0,
    height: p.height ?? 0,
  }
}

export default function Album() {
  const { albumId } = useParams()
  const { user } = useAuth()
  const [album, setAlbum] = useState<PublicAlbum | null>(null)
  const [photos, setPhotos] = useState<PublicPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [selectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searchOpen, setSearchOpen] = useState(false)
  const { perPage } = useResponsivePageSize()
  const [visibleCount, setVisibleCount] = useState(perPage)
  const { ref: gridRef, cols } = useGridColumns()
  // Round up so the last row is always complete (never a lone cell).
  const shown =
    visibleCount >= photos.length
      ? photos.length
      : Math.min(photos.length, Math.ceil(visibleCount / cols) * cols)

  useEffect(() => {
    let active = true
    async function load() {
      if (!albumId) return
      setLoading(true)
      setError('')
      try {
        const [a, pho] = await Promise.all([
          getPublicAlbum(albumId),
          listAlbumPhotos(albumId),
        ])
        if (!active) return
        if (!a) {
          setError('album-not-found')
        } else {
          setAlbum(a)
          setPhotos(pho)
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [albumId])

  const openViewer = (photo: Photo) => {
    if (selectMode) return
    const i = photos.findIndex((p) => p.id === photo.id)
    setViewerIndex(i >= 0 ? i : 0)
  }

  const toggleSelect = (photo: Photo) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(photo.id)) next.delete(photo.id)
      else next.add(photo.id)
      return next
    })
  }

  void photos



  { const _x = async () => {}; void _x }



  if (loading) {
    return (
      <PageFade>
        <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
          <Loader2 size={22} className="animate-spin text-brand-600" />
          กำลังโหลด…
        </div>
      </PageFade>
    )
  }

  if (error === 'album-not-found' || (!album && !error)) {
    return (
      <PageFade className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Album not found</h1>
        <p className="mt-2 text-slate-500">
          The album you're looking for doesn't exist.
        </p>
        <Link
          to="/gallery"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
        >
          <ArrowLeft size={18} />
          กลับไปยังแกลเลอรี่
        </Link>
      </PageFade>
    )
  }

  if (error || !album) {
    return (
      <PageFade className="mx-auto max-w-3xl px-6 py-24 text-center">
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error || 'โหลดอัลบั้มไม่สำเร็จ'}
        </p>
        <Link
          to="/gallery"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
        >
          <ArrowLeft size={18} />
          กลับไปยังแกลเลอรี่
        </Link>
      </PageFade>
    )
  }

  return (
    <PageFade>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <Link
          to="/gallery"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-700"
        >
          <ArrowLeft size={18} />
          กลับไปยังแกลเลอรี่
        </Link>

        <header className="mt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {album.name}
            </h1>
            {album.description && (
              <p className="mt-3 max-w-2xl text-slate-500">{album.description}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Images size={15} className="text-brand-600" />
                {photos.length} รูป
              </span>
              {album.event_date && <span>{formatDateThai(album.event_date)}</span>}
              {album.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} />
                  {album.location}
                </span>
              )}
            </div>
          </div>

          {/* Selection toolbar removed - download available via face search for logged in users */}
        </header>

        {/* Face search bar — searches within THIS album only */}
        {user && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            disabled={photos.length === 0}
            className="group mb-6 flex w-full items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3.5 text-left transition-all hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="inline-flex rounded-xl bg-brand-600 p-2 text-white shadow-sm shadow-brand-600/30 transition-transform group-hover:scale-105">
              <ScanFace size={20} />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-bold text-slate-900">
                ค้นหาภาพจากใบหน้า
              </span>
              <span className="text-xs text-slate-500">
                ค้นในอัลบั้มนี้ · {album.name} ({photos.length} ภาพ)
              </span>
            </span>
          </button>
        )}

        {photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-slate-500">
            ยังไม่มีรูปในอัลบั้มนี้
          </div>
        ) : (
          <>
            <div
              ref={gridRef}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5"
            >
              {photos.slice(0, shown).map((photo) => (
                <div
                  key={photo.id}
                  className="relative group"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <ImageCard
                    photo={toPhoto(photo)}
                    onClick={openViewer}
                    selectable={selectMode}
                    selected={selected.has(photo.id)}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
            </div>

            {shown < photos.length && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + perPage)}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-6 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:border-brand-400 hover:bg-brand-50"
                >
                  ดูภาพเพิ่มเติม
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {viewerIndex !== null && (
          <ImageViewer
            photos={photos.map(toPhoto)}
            index={viewerIndex}
            onClose={() => setViewerIndex(null)}
            onNavigate={setViewerIndex}
          />
        )}
      </AnimatePresence>

      <FaceSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        scopeLabel={`ค้นในอัลบั้มนี้ · ${album.name}`}
        albumId={albumId}
      />
    </PageFade>
  )
}