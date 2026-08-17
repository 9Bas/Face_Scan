import { useRef, useState, type ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  Download,
  ImageUp,
  Loader2,
  ScanFace,
  Search as SearchIcon,
  X,
} from 'lucide-react'
import { type Photo, downloadPhoto } from '../data'
import { searchByFace } from '../lib/faceSearchService'
// Staff debug — similarity/faces UI is disabled (commented out). To re-enable:
//  1. restore `type FaceSearchResult` in the import above
//  2. restore the `useAuth` import + `isStaff`/`user` lines
//  3. restore `rawResults`/`facesDetected` state, the setters, and the JSX blocks below
import ImageCard from './ImageCard'
import ImageViewer from './ImageViewer'

interface FaceSearchModalProps {
  open: boolean
  onClose: () => void
  /** Shown under the title, e.g. "ค้นจากทุกอัลบั้ม" or "ค้นในอัลบั้มนี้". */
  scopeLabel: string
  /** Restrict search to this album. null/undefined = search all albums. */
  albumId?: string | null
}

export default function FaceSearchModal({
  open,
  onClose,
  scopeLabel,
  albumId,
}: FaceSearchModalProps) {
  // const { user } = useAuth() // staff debug
  // const isStaff = !!user // staff-only similarity/debug UI is disabled
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [statusLabel, setStatusLabel] = useState('กำลังสแกนใบหน้า…')
  const [results, setResults] = useState<Photo[]>([])
  // const [rawResults, setRawResults] = useState<FaceSearchResult[]>([]) // staff debug
  // const [facesDetected, setFacesDetected] = useState(0) // staff debug
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [searchError, setSearchError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const lastFileRef = useRef<File | null>(null)

  const reset = () => {
    setPreview(null)
    setFileName('')
    setStatus('idle')
    setResults([])
    // setRawResults([]) // staff debug
    // setFacesDetected(0) // staff debug
    if (fileRef.current) fileRef.current.value = ''
  }

  const close = () => {
    reset()
    setViewerIndex(null)
    onClose()
  }

  const onFileSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    lastFileRef.current = file
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)
    setStatus('idle')
    setSearchError('')
    setResults([])
  }

  const triggerSearch = async () => {
    if (!preview || !lastFileRef.current) return
    setStatus('loading')
    setSearchError('')
    setResults([])
    // setRawResults([]) // staff debug
    setStatusLabel('กำลังสแกนใบหน้าด้วย ArcFace…')
    try {
      const { results: hits } = await searchByFace(
        lastFileRef.current,
        { albumId },
      )
      // setFacesDetected(n) // staff debug
      // setRawResults(hits) // staff debug
      const mapped: Photo[] = hits.map((h) => ({
        id: h.photo_id,
        url: h.url,
        thumb: h.thumb_url ?? h.url,
        title: h.filename,
        width: 0,
        height: 0,
      }))
      setResults(mapped)
      setStatus('done')
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'ค้นหาไม่สำเร็จ')
      setStatus('error')
    }
  }

  const openViewer = (photo: Photo) => {
    const i = results.findIndex((p) => p.id === photo.id)
    setViewerIndex(i >= 0 ? i : 0)
  }

  const downloadAll = async () => {
    if (downloading || results.length === 0) return
    setDownloading(true)
    for (const photo of results) {
      await downloadPhoto(photo)
      await new Promise((r) => setTimeout(r, 350))
    }
    setDownloading(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="face-search-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={close}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Face search"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-600">
                  <ScanFace size={22} />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    ค้นหาภาพจากใบหน้า
                  </h2>
                  <p className="text-xs font-medium text-brand-700">
                    {scopeLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileSelected}
              />

              <AnimatePresence mode="wait">
                {!preview ? (
                  <motion.div
                    key="drop"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onClick={() => fileRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50"
                  >
                    <span className="inline-flex rounded-2xl bg-white p-4 text-brand-600 shadow-sm ring-1 ring-slate-100">
                      <ImageUp size={28} />
                    </span>
                    <p className="mt-4 text-base font-semibold text-slate-700">
                      อัปโหลดรูปใบหน้าของคุณ
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      ลากวาง หรือคลิกเพื่อเลือกรูป (JPG / PNG)
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        fileRef.current?.click()
                      }}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      <Camera size={16} />
                      เลือกรูปใบหน้า
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        <img
                          src={preview}
                          alt="Selected face"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={reset}
                          aria-label="Remove"
                          className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white transition-colors hover:bg-slate-900"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-700">
                          รูปที่เลือก
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {fileName}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={triggerSearch}
                            disabled={status === 'loading'}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                          >
                            {status === 'loading' ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <SearchIcon size={16} />
                            )}
                            {status === 'loading' ? 'กำลังค้นหา…' : 'ค้นหา'}
                          </button>
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                          >
                            เปลี่ยนรูป
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Loading */}
                    {status === 'loading' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center gap-2.5 py-8 text-slate-400"
                      >
                        <Loader2 size={22} className="animate-spin text-brand-600" />
                        <span className="text-sm">{statusLabel}</span>
                      </motion.div>
                    )}

                    {/* Error */}
                    {status === 'error' && (
                      <motion.p
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600"
                      >
                        {searchError}
                      </motion.p>
                    )}

                    {/* Results */}
                    {status === 'done' && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-base font-bold text-slate-900">
                            ผลการค้นหา
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">
                              พบ {results.length} ภาพ
                              {/* staff debug: faces detected
                              {isStaff && facesDetected > 1
                                ? ` · ตรวจพบ ${facesDetected} ใบหน้าในรูปค้นหา`
                                : ''}
                              */}
                            </span>
                            {results.length > 0 && (
                              <button
                                type="button"
                                onClick={downloadAll}
                                disabled={downloading}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                              >
                                {downloading ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Download size={14} />
                                )}
                                ดาวน์โหลดทั้งหมด
                              </button>
                            )}
                          </div>
                        </div>
                        {results.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                            <p className="text-slate-500">ไม่พบภาพที่ตรง</p>
                            <p className="mt-1 text-sm text-slate-400">
                              ลองใช้รูปใบหน้าที่ชัดขึ้น
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* staff debug: similarity legend
                            {isStaff && (
                              <div className="mb-2 text-xs text-slate-400">
                                ค่าความคล้าย = 1 − cosine distance (ยิ่งใกล้ 1 ยิ่งเหมือน)
                                · ระยะทางต่ำสุด {rawResults[0]?.distance.toFixed(3)}
                              </div>
                            )}
                            */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                              {results.map((photo) => (
                                <div key={photo.id} className="relative">
                                  <ImageCard photo={photo} onClick={openViewer} />
                                  {/* staff debug: per-photo similarity
                                  {isStaff && (
                                    <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                      {rawResults[i]?.similarity.toFixed(2)}
                                    </span>
                                  )}
                                  */}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence key="face-search-viewer">
        {viewerIndex !== null && (
          <ImageViewer
            photos={results}
            index={viewerIndex}
            onClose={() => setViewerIndex(null)}
            onNavigate={setViewerIndex}
          />
        )}
      </AnimatePresence>
    </AnimatePresence>
  )
}