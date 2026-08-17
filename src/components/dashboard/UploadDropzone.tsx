import { useCallback, useRef, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  ImageIcon,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'
import {
  uploadPhotos,
  type UploadFileState,
  type UploadProgress,
} from '../../lib/photoService'

interface UploadDropzoneProps {
  albumId: string
  /** Called after the batch finishes so caller can refresh the gallery. */
  onUploaded: () => void
  /** Variant — modal (inside album detail) vs inline (page). */
  variant?: 'inline' | 'modal'
}

export default function UploadDropzone({
  albumId,
  onUploaded,
  variant = 'inline',
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<{
    uploaded: number
    failed: number
  } | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (arr.length === 0) return
      setBusy(true)
      setSummary(null)
      setProgress({
        fraction: 0,
        done: 0,
        total: arr.length,
        currentName: null,
        files: arr.map((f, i) => ({
          id: `${Date.now()}-${i}`,
          name: f.name,
          size: f.size,
          status: 'pending' as const,
          previewUrl: f.type.startsWith('image/')
            ? URL.createObjectURL(f)
            : undefined,
        })),
      })
      const res = await uploadPhotos(albumId, arr, setProgress)
      setBusy(false)
      setSummary({ uploaded: res.uploaded.length, failed: res.failed.length })
      if (res.uploaded.length > 0) onUploaded()
    },
    [albumId, onUploaded],
  )

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
  }

  const onPickChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void handleFiles(e.target.files)
    e.target.value = ''
  }

  const reset = () => {
    setProgress(null)
    setSummary(null)
  }

  const inner = (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !busy && inputRef.current?.click()}
      className={[
        'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragging
          ? 'border-brand-500 bg-brand-50'
          : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/50',
        busy && 'pointer-events-none opacity-80',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPickChange}
      />
      <motion.span
        animate={dragging ? { scale: 1.1 } : { scale: 1 }}
        className="inline-flex rounded-2xl bg-white p-4 text-brand-600 shadow-sm ring-1 ring-slate-100"
      >
        <UploadCloud size={30} />
      </motion.span>
      <p className="mt-4 text-base font-semibold text-slate-700">
        ลากรูปมาวาง หรือคลิกเพื่อเลือก
      </p>
      <p className="mt-1 text-xs text-slate-400">
        รองรับหลายไฟล์ — JPG / PNG / WEBP
      </p>
    </div>
  )

  return (
    <div className={variant === 'modal' ? '' : ''}>
      {inner}

      {/* Progress / file list */}
      <AnimatePresence>
        {progress && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            {/* Overall bar */}
            <div className="px-4 pt-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>
                  {progress.done}/{progress.total} ไฟล์
                </span>
                {progress.currentName && (
                  <span className="truncate pl-3 text-slate-400">
                    {progress.currentName}
                  </span>
                )}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full bg-brand-500"
                  animate={{ width: `${progress.fraction * 100}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </div>

            {/* Per-file list */}
            <ul className="max-h-60 overflow-y-auto px-4 py-3">
              {progress.files.map((f) => (
                <FileRow key={f.id} f={f} />
              ))}
            </ul>

            {/* Summary + reset */}
            {summary && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs">
                <p
                  className={
                    summary.failed > 0
                      ? 'font-semibold text-slate-600'
                      : 'font-semibold text-brand-700'
                  }
                >
                  ✓ อัปโหลด {summary.uploaded} รูป
                  {summary.failed > 0 && (
                    <span className="ml-2 text-red-600">
                      • ล้มเหลว {summary.failed} รูป
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <X size={13} />
                  ปิด
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FileRow({ f }: { f: UploadFileState }) {
  return (
    <li className="flex items-center gap-3 py-1.5 text-xs">
      <span className="h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-100">
        {f.previewUrl ? (
          <img
            src={f.previewUrl}
            alt={f.name}
            className="h-full w-full object-cover"
          />
        ) : f.status === 'done' ? (
          <span className="flex h-full items-center justify-center text-brand-600">
            <CheckCircle2 size={16} />
          </span>
        ) : (
          <span className="flex h-full items-center justify-center text-slate-400">
            <ImageIcon size={14} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-slate-700">{f.name}</span>
      <span className="shrink-0 text-slate-400">
        {f.status === 'uploading' && (
          <Loader2 size={14} className="animate-spin text-brand-600" />
        )}
        {f.status === 'inserting' && (
          <Loader2 size={14} className="animate-spin text-brand-600" />
        )}
        {f.status === 'done' && (
          <CheckCircle2 size={14} className="text-brand-600" />
        )}
        {f.status === 'error' && (
          <span className="text-red-600">{f.error ?? 'ล้มเหลว'}</span>
        )}
      </span>
    </li>
  )
}