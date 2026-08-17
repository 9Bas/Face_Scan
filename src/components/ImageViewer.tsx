import { Download } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { downloadPhoto, type Photo } from '../data'

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
  /** Show photo title/filename at the bottom. Defaults to true. */
  showTitle?: boolean
}

export default function ImageViewer({
  photos,
  index,
  onClose,
  onNavigate,
  showTitle = true,
}: ImageViewerProps) {
  const total = photos.length
  const [downloading, setDownloading] = useState(false)
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

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadPhoto(photos[index])
    } finally {
      setDownloading(false)
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
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Download"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span className="hidden sm:inline">
              {downloading ? 'Preparing…' : 'ดาวน์โหลด'}
            </span>
          </button>
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
          <motion.img
            key={photo.id}
            src={photo.url}
            alt={photo.title}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
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

      {showTitle && <p className="pb-5 text-center text-sm text-white/60">{photo.title}</p>}
    </motion.div>
  )
}