import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  Images,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../auth'
import {
  createAlbum,
  deleteAlbum,
  listMyAlbums,
  updateAlbum,
  type AlbumWithMeta,
  type AlbumInput,
} from '../lib/albumService'
import { storage } from '../lib/storage'
import { PageFade } from '../components/motion'
import { formatDateThai } from '../lib/date'
import AlbumFormDialog, {
  type AlbumFormValues,
} from '../components/dashboard/AlbumFormDialog'
import ConfirmDialog from '../components/dashboard/ConfirmDialog'

const categoryLabel: Record<string, string> = {
  sports: 'กีฬา',
  academic: 'วิชาการ',
  activities: 'กิจกรรม',
  culture: 'วัฒนธรรม',
}

const ease = [0.16, 1, 0.3, 1] as const

export default function DashboardAlbums() {
  const { user } = useAuth()
  const [albums, setAlbums] = useState<AlbumWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  // Portal target for the fixed toolbar bar (mounted in DashboardLayout).
  const [toolbarEl, setToolbarEl] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const el = document.getElementById('dashboard-page-toolbar')
    if (el) setToolbarEl(el)
  }, [])

  // dialog state
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editing, setEditing] = useState<AlbumWithMeta | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<AlbumWithMeta | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Open create form via ?action=new query param (quick action link)
  useEffect(() => {
    if (window.location.hash.includes('action=new') || window.location.search.includes('action=new')) {
      openCreate()
    }
  }, [])

  const reload = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      const data = await listMyAlbums(user.id)
      setAlbums(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดอัลบั้มไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const openCreate = () => {
    setFormMode('create')
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (album: AlbumWithMeta) => {
    setFormMode('edit')
    setEditing(album)
    setFormOpen(true)
  }

  const handleFormSubmit = async (values: AlbumFormValues) => {
    if (!user) return
    setFormLoading(true)
    const input: AlbumInput = {
      name: values.name,
      description: values.description || null,
      event_date: values.event_date || null,
      location: values.location || null,
      category: (values.category || null) as AlbumInput['category'],
    }
    try {
      if (formMode === 'create') {
        await createAlbum(user.id, input)
      } else if (editing) {
        await updateAlbum(editing.id, input)
      }
      setFormOpen(false)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setFormLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      // Phase 4: delete DB rows (cascade photos). R2 cleanup comes in Phase 6/8.
      await deleteAlbum(deleteTarget.id, async (photo) => {
        // Will be a no-op in mock; real R2 delete plugged in during Phase 6/8.
        await storage.deletePhoto(photo.storage_path, photo.thumbnail_path)
      })
      setDeleteTarget(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ')
    } finally {
      setDeleteLoading(false)
    }
  }

  const q = query.trim().toLowerCase()
  const filteredAlbums = albums.filter(
    (a) =>
      !q ||
      a.name.toLowerCase().includes(q) ||
      (a.description ?? '').toLowerCase().includes(q) ||
      (a.location ?? '').toLowerCase().includes(q),
  )

  return (
    <>
      {toolbarEl &&
        createPortal(
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">อัลบั้มทั้งหมด</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {albums.length > 0 && (
                <div className="relative w-full max-w-xs sm:w-auto">
                  <Search
                    size={17}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหาอัลบั้ม…"
                    className="input w-full rounded-xl py-2"
                    style={{ paddingLeft: 44 }}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                <Plus size={18} />
                สร้างอัลบั้ม
              </button>
            </div>
          </div>
        </>,
        toolbarEl,
      )}

      <PageFade>
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin text-brand-600" />
          กำลังโหลด…
        </div>
      ) : albums.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Images size={36} className="mx-auto text-slate-300" />
          <p className="mt-3 text-slate-500">ยังไม่มีอัลบั้ม</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} />
            สร้างอัลบั้มแรก
          </button>
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Search size={36} className="mx-auto text-slate-300" />
          <p className="mt-3 text-slate-500">
            ไม่พบอัลบั้มที่ค้นหา{query.trim() ? ` "${query.trim()}"` : ''}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAlbums.map((album, i) => (
            <motion.div
              key={album.id}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <Link
                to={`/dashboard/albums/${album.id}`}
                className="relative block aspect-[4/3] overflow-hidden bg-slate-100"
              >
                {album.cover_url ? (
                  <img
                    src={storage.getViewUrl(album.cover_url)}
                    alt={album.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">
                    <Images size={36} />
                  </div>
                )}
                <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  <Images size={13} className="text-brand-600" />
                  {album.photo_count} รูป
                </span>
              </Link>

              <div className="flex flex-1 flex-col p-4">
                <Link to={`/dashboard/albums/${album.id}`}>
                  <h3 className="text-base font-bold text-slate-900 hover:text-brand-700">
                    {album.name}
                  </h3>
                </Link>
                {album.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {album.description}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-slate-400">
                  {album.category && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">
                      {categoryLabel[album.category]}
                    </span>
                  )}
                  {album.event_date && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDateThai(album.event_date)}
                    </span>
                  )}
                  {album.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {album.location}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => openEdit(album)}
                  aria-label="แก้ไข"
                  className="rounded-lg bg-white/90 p-2 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-brand-700"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(album)}
                  aria-label="ลบ"
                  className="rounded-lg bg-white/90 p-2 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AlbumFormDialog
        open={formOpen}
        mode={formMode}
        loading={formLoading}
        onSubmit={handleFormSubmit}
        onClose={() => setFormOpen(false)}
        initial={
          editing
            ? {
                name: editing.name,
                description: editing.description ?? '',
                event_date: editing.event_date ?? '',
                location: editing.location ?? '',
                category: editing.category ?? '',
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="ลบอัลบั้มนี้"
        message={`"${deleteTarget?.name}" และรูปภาพทั้งหมดข้างในจะถูกลบ และไม่สามารถกู้คืนได้`}
        destructive
        confirmLabel="ลบถาวร"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      </PageFade>
    </>
  )
}