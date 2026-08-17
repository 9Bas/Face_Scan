import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  CheckCheck,
  Images,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react'
import { getAlbum, updateAlbum, type AlbumWithMeta } from '../lib/albumService'
import {
  deletePhoto,
  deletePhotos,
  listPhotos,
  type PhotoDTO,
} from '../lib/photoService'
import type { PhotoRow } from '../lib/types'
import { PageFade } from '../components/motion'
import UploadDropzone from '../components/dashboard/UploadDropzone'
import ConfirmDialog from '../components/dashboard/ConfirmDialog'
import AlbumFormDialog, {
  type AlbumFormValues,
} from '../components/dashboard/AlbumFormDialog'

const categoryLabel: Record<string, string> = {
  sports: 'กีฬา',
  academic: 'วิชาการ',
  activities: 'กิจกรรม',
  culture: 'วัฒนธรรม',
}

export default function DashboardAlbumDetail() {
  const { albumId } = useParams()
  const [album, setAlbum] = useState<AlbumWithMeta | null>(null)
  const [photos, setPhotos] = useState<PhotoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  // single delete
  const [deleteTarget, setDeleteTarget] = useState<PhotoDTO | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // bulk delete
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkTarget, setBulkTarget] = useState<number | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const PHOTOS_PER_PAGE = 15
  const [visibleCount, setVisibleCount] = useState(PHOTOS_PER_PAGE)

  const reload = useCallback(async () => {
    if (!albumId) return
    setLoading(true)
    try {
      const [a, ph] = await Promise.all([getAlbum(albumId), listPhotos(albumId)])
      setAlbum(a)
      setPhotos(ph)
    } catch (err) {
      // ignore — toast-less
      void err
    } finally {
      setLoading(false)
    }
  }, [albumId])

  useEffect(() => {
    reload()
  }, [reload])

  const handleEdit = async (values: AlbumFormValues) => {
    if (!album) return
    setEditLoading(true)
    try {
      await updateAlbum(album.id, {
        name: values.name,
        description: values.description || null,
        event_date: values.event_date || null,
        location: values.location || null,
        category: (values.category || null) as AlbumWithMeta['category'],
      })
      setToast('บันทึกอัลบั้มแล้ว')
      setEditOpen(false)
      await reload()
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeletePhoto = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deletePhoto(deleteTarget.id, {
        id: deleteTarget.id,
        album_id: albumId ?? '',
        storage_path: (deleteTarget as PhotoRow).storage_path,
        thumbnail_path: (deleteTarget as PhotoRow).thumbnail_path,
      })
      setToast('ลบรูปแล้ว')
      setDeleteTarget(null)
      await reload()
    } finally {
      setDeleteLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAll = () => setSelected(new Set(photos.map((p) => p.id)))
  const clearAll = () => setSelected(new Set())

  const handleBulkDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      setBulkTarget(null)
      return
    }
    setBulkLoading(true)
    const items = photos.filter((p) => selected.has(p.id))
    const cleanups = items.map((p) => ({
      id: p.id,
      album_id: albumId ?? '',
      storage_path: (p as PhotoRow).storage_path,
      thumbnail_path: (p as PhotoRow).thumbnail_path,
    }))
    const res = await deletePhotos(cleanups)
    setBulkLoading(false)
    setBulkTarget(null)
    setSelectMode(false)
    setSelected(new Set())
    setToast(
      `ลบ ${cleanups.length - res.failed} รูป${
        res.failed > 0 ? ` · ล้มเหลว ${res.failed}` : ''
      }`,
    )
    await reload()
  }

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

  if (!album) {
    return (
      <PageFade>
        <Link
          to="/dashboard/albums"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft size={18} />
          กลับไปอัลบั้ม
        </Link>
        <p className="mt-6 text-slate-500">
          ไม่พบอัลบั้ม หรือคุณไม่มีสิทธิ์เข้าถึง
        </p>
      </PageFade>
    )
  }

  const allSelected = photos.length > 0 && selected.size === photos.length

  return (
    <PageFade>
      <Link
        to="/dashboard/albums"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-700"
      >
        <ArrowLeft size={18} />
        กลับไปอัลบั้ม
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {album.name}
          </h1>
          {album.description && (
            <p className="mt-2 max-w-2xl text-slate-500">{album.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Images size={14} className="text-brand-600" />
              {photos.length} รูป
            </span>
            {album.event_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} />
                {album.event_date}
              </span>
            )}
            {album.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} />
                {album.location}
              </span>
            )}
            {album.category && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                {categoryLabel[album.category]}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"        >
          <Pencil size={16} />
          แก้ไขอัลบั้ม
        </button>
      </div>

      {/* Upload */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
          อัปโหลดรูป
        </h2>
        <UploadDropzone albumId={album.id} onUploaded={reload} />
      </section>

      {/* Photos grid */}
      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            รูปภาพในอัลบั้ม
          </h2>
          {/* Bulk select toolbar */}
          {photos.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!selectMode ? (
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  className="rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                >
                  เลือก
                </button>
              ) : (
                <>
                  <span className="mr-1 text-xs font-medium text-slate-500">
                    {selected.size} รูป
                  </span>
                  <button
                    type="button"
                    onClick={allSelected ? clearAll : selectAll}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                  >
                    <CheckCheck size={14} />
                    {allSelected ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTarget(selected.size)}
                    disabled={selected.size === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    ลบที่เลือก
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectMode(false)
                      setSelected(new Set())
                    }}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-500">
            ยังไม่มีรูปในอัลบั้ม — อัปโหลดได้ด้านบน
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
              {photos.slice(0, visibleCount).map((p) => {
                const isSel = selected.has(p.id)
                return (
                  <div
                    key={p.id}
                    className={[
                      'group relative overflow-hidden rounded-xl bg-slate-100',
                      isSel ? 'ring-2 ring-brand-500' : '',
                    ].join(' ')}
                    style={{ aspectRatio: '4 / 3' }}
                  >
                    <img
                      src={p.thumb_url ?? p.url}
                      alt={p.filename}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    {/* select checkbox */}
                    {selectMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelect(p.id)}
                        aria-label={isSel ? 'ยกเลิกเลือก' : 'เลือก'}
                        className={[
                          'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-md transition-all',
                          isSel
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-white bg-white/80 text-transparent backdrop-blur hover:bg-white',
                        ].join(' ')}
                      >
                        <CheckCheck size={15} strokeWidth={3} />
                      </button>
                    )}
                    {/* single delete (only in non-select mode) */}
                    {!selectMode && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        aria-label="ลบรูป"
                        className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-slate-600 shadow-sm backdrop-blur transition-all opacity-0 group-hover:opacity-100 hover:bg-white hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {visibleCount < photos.length && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PHOTOS_PER_PAGE)}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-6 py-2.5 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:border-brand-400 hover:bg-brand-50"
                >
                  ดูภาพเพิ่มเติม
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <AlbumFormDialog
        open={editOpen}
        mode="edit"
        loading={editLoading}
        onSubmit={handleEdit}
        onClose={() => setEditOpen(false)}
        initial={{
          name: album.name,
          description: album.description ?? '',
          event_date: album.event_date ?? '',
          location: album.location ?? '',
          category: album.category ?? '',
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="ลบรูปนี้"
        message={`"${deleteTarget?.filename}" จะถูกลบถาวร`}
        destructive
        confirmLabel="ลบ"
        loading={deleteLoading}
        onConfirm={handleDeletePhoto}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkTarget !== null}
        title={`ลบรูป ${bulkTarget ?? 0} รูป`}
        message="รูปที่เลือกทั้งหมดจะถูกลบถาวร (ไฟล์ + ฐานข้อมูล) และไม่สามารถกู้คืนได้"
        destructive
        confirmLabel="ลบทั้งหมด"
        loading={bulkLoading}
        onConfirm={handleBulkDelete}
        onCancel={() => setBulkTarget(null)}
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            onAnimationComplete={() => {
              setTimeout(() => setToast(null), 2200)
            }}
            className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </PageFade>
  )
}