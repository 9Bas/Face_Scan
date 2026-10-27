import { Flag } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X, MessageSquareText } from 'lucide-react'
import { type Photo } from '../data'
import { useAuth } from '../auth'
import { createDeletionRequest } from '../lib/deletionRequestService'
import { Toast, type ToastState } from './Toast'
import WatermarkOverlay from './WatermarkOverlay'

/** Warm the browser cache for the neighboring images (instant next/prev). */
function usePreload(photos: Photo[], index: number): void {
  useEffect(() => {
    const targets = [index - 1, index + 1]
      .filter((i) => i >= 0 && i < photos.length)
      .map((i) => photos[i].url)
    for (const url of targets) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = url
      document.head.appendChild(link)
      setTimeout(() => link.remove(), 30000)
    }
  }, [photos, index])
}

export interface ImageViewerProps {
  photos: Photo[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export default function ImageViewer({
  photos,
  index,
  onClose,
  onNavigate,
}: ImageViewerProps) {
  const { user } = useAuth()
  const total = photos.length
  const [requesting, setRequesting] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [reason, setReason] = useState('')
  usePreload(photos, index)

  const prev = useCallback(
    () => onNavigate((index - 1 + total) % total),
    [index, total, onNavigate],
  )
  const next = useCallback(() => onNavigate((index + 1) % total), [
    index,
    total,
    onNavigate,
  ])

  const handleRequestDelete = () => {
    if (requesting || !user) {
      if (!user) {
        setToast({ id: Date.now(), message: 'กรุณาเข้าสู่ระบบเพื่อแจ้งขอลบรูป' })
      }
      return
    }
    setReason('')
    setShowReasonModal(true)
  }

  const submitRequestDelete = async () => {
    if (requesting || !user) return
    setRequesting(true)
    try {
      await createDeletionRequest((photos[index] as any).id, user.id, user.email, reason.trim() || undefined)
      setToast({ id: Date.now(), message: 'ส่งคำขอลบรูปเรียบร้อย' })
      setShowReasonModal(false)
      setReason('')
    } catch (err) {
      setToast({
        id: Date.now(),
        message: err instanceof Error ? err.message : 'ส่งคำขอลบไม่สำเร็จ',
      })
    } finally {
      setRequesting(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  if (index < 0 || index >= total) return null
  const photo = photos[index]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-sm"
      role="dialog"
      aria-label="Image viewer"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/80">
        <span className="text-sm font-medium">
          {index + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={handleRequestDelete}
              disabled={requesting}
              aria-label="แจ้งขอลบรูป"
              className="inline-flex items-center gap-2 rounded-full bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-600 disabled:opacity-60"
            >
              {requesting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Flag size={16} />
              )}
              <span className="hidden sm:inline">
                {requesting ? 'กำลังส่ง…' : 'แจ้งลบรูป'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6">
        {total > 1 && (
          <button
            type="button"
            onClick={prev}
            aria-label="Previous"
            className="absolute left-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 sm:left-6"
          >
            <ChevronLeft size={26} />
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-full max-w-full"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <img
              src={photo.url}
              alt={photo.title}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              draggable={false}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl select-none"
              style={{ WebkitTouchCallout: 'none' }}
            />
            <WatermarkOverlay />
            <div
              className="absolute inset-0"
              onContextMenu={(e) => e.preventDefault()}
              aria-hidden="true"
            />
          </motion.div>
        </AnimatePresence>

        {total > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Next"
            className="absolute right-3 z-10 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/25 sm:right-6"
          >
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      <p className="pb-5 text-center text-sm text-white/60">{photo.title}</p>

      <AnimatePresence>
        {showReasonModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4"
            onClick={() => !requesting && setShowReasonModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                  <MessageSquareText size={20} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">แจ้งขอลบรูปภาพ</h3>
                  <p className="text-sm text-slate-500">ระบุเหตุผล (ไม่บังคับ)</p>
                </div>
              </div>
              <div className="px-6 py-4">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="เช่น รูปนี้ไม่ต้องการให้แสดง หรือมีปัญหาด้านสิทธิ์..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
                <button
                  type="button"
                  onClick={() => !requesting && setShowReasonModal(false)}
                  disabled={requesting}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={submitRequestDelete}
                  disabled={requesting}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  {requesting && <Loader2 size={16} className="animate-spin" />}
                  ส่งคำขอ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </motion.div>
  )
}