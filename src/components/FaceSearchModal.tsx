import { useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  Check,
  Download,
  ImageUp,
  Loader2,
  LogIn,
  ScanFace,
  Search as SearchIcon,
  UserCog,
  X,
} from 'lucide-react'
import { type Photo, downloadPhoto } from '../data'
import { profileAvatarUrl, searchByProfileFace } from '../lib/profileFaceService'
import { useAuth } from '../auth'
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
  const { user } = useAuth()
  const avatarUrl = profileAvatarUrl(user?.avatarPath)
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [statusLabel, setStatusLabel] = useState('กำลังสแกนใบหน้า…')
  const [results, setResults] = useState<Photo[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [searchError, setSearchError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastFileRef = useRef<File | null>(null)

  const reset = () => {
    setPreview(null)
    setFileName('')
    setStatus('idle')
    setResults([])
    setSelectMode(false)
    setSelected(new Set())
    lastFileRef.current = null
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

  const runSearch = async (file?: File | null) => {
    if (!user) return
    setStatus('loading')
    setSearchError('')
    setResults([])
    setSelectMode(false)
    setSelected(new Set())
    setStatusLabel(
      file
        ? 'กำลังตรวจสอบว่าเป็นใบหน้าของคุณ…'
        : 'กำลังค้นหาด้วยใบหน้าจากโปรไฟล์ของคุณ…',
    )
    try {
      const hits = await searchByProfileFace({ albumId, file: file ?? null })
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

  const triggerSelfieSearch = () => {
    if (!lastFileRef.current) return
    void runSearch(lastFileRef.current)
  }

  const openViewer = (photo: Photo) => {
    if (selectMode) return
    const i = results.findIndex((p) => p.id === photo.id)
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

  const selectAll = () => setSelected(new Set(results.map((p) => p.id)))
  const clearAll = () => setSelected(new Set())
  const enterSelectMode = () => setSelectMode(true)
  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  const allSelected = results.length > 0 && selected.size === results.length

  const downloadSelected = async () => {
    if (!user) return
    if (downloading || selected.size === 0) return
    setDownloading(true)
    const items = results.filter((p) => selected.has(p.id))
    for (const photo of items) {
      await downloadPhoto(photo)
      await new Promise((r) => setTimeout(r, 350))
    }
    setDownloading(false)
  }

  const needsSetup = !!user && user.faceEnrolled === false
  const showProfilePicker = !preview && status === 'idle'

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
                {/* 1) Signed out — face search is tied to the member profile */}
                {!user ? (
                  <motion.div
                    key="signed-out"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-12 text-center"
                  >
                    <span className="inline-flex rounded-2xl bg-white p-4 text-brand-600 shadow-sm ring-1 ring-slate-100">
                      <LogIn size={28} />
                    </span>
                    <p className="mt-4 text-base font-semibold text-slate-700">
                      เข้าสู่ระบบเพื่อค้นหาด้วยใบหน้า
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-slate-400">
                      ระบบค้นหาและดาวน์โหลดจะแสดงเฉพาะภาพที่มีใบหน้าของเจ้าของบัญชีเท่านั้น
                    </p>
                    <Link
                      to="/login"
                      onClick={close}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      <LogIn size={16} />
                      เข้าสู่ระบบ
                    </Link>
                  </motion.div>
                ) : needsSetup ? (
                  /* 2) Member without a profile face */
                  <motion.div
                    key="needs-setup"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-6 py-12 text-center"
                  >
                    <span className="inline-flex rounded-2xl bg-white p-4 text-brand-600 shadow-sm ring-1 ring-slate-100">
                      <UserCog size={28} />
                    </span>
                    <p className="mt-4 text-base font-semibold text-slate-700">
                      ยังไม่ได้ตั้งภาพโปรไฟล์
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-slate-400">
                      ตั้งภาพโปรไฟล์ของคุณก่อน เพื่อให้ระบบค้นหาได้เฉพาะภาพที่ตรงกับใบหน้าของคุณ
                    </p>
                    <Link
                      to="/setup-profile"
                      onClick={close}
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                      <Camera size={16} />
                      ตั้งภาพโปรไฟล์
                    </Link>
                  </motion.div>
                ) : showProfilePicker ? (
                  /* 3) Search using the enrolled profile face */
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col items-center rounded-2xl border border-brand-100 bg-brand-50/60 px-6 py-8 text-center">
                      <div className="relative h-24 w-24 overflow-hidden rounded-full bg-white shadow-sm ring-4 ring-white">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="ภาพโปรไฟล์ของคุณ"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-brand-500">
                            <ScanFace size={34} />
                          </span>
                        )}
                      </div>
                      <p className="mt-4 text-base font-semibold text-slate-800">
                        ค้นหาด้วยใบหน้าของคุณ
                      </p>
                      <p className="mt-1 max-w-md text-sm text-slate-500">
                        ระบบใช้ใบหน้าจากภาพโปรไฟล์ในการค้นหา จึงแสดงเฉพาะภาพของเจ้าของบัญชีเท่านั้น
                      </p>
                      <button
                        type="button"
                        onClick={() => void runSearch(null)}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                      >
                        <SearchIcon size={16} />
                        ค้นหาด้วยใบหน้าของฉัน
                      </button>
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex rounded-xl bg-slate-100 p-2 text-slate-500">
                          <ImageUp size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-700">
                            หรือใช้รูปเซลฟี่
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            ระบบจะตรวจว่าเป็นใบหน้าของคุณก่อนค้นหา (ไม่บันทึกเป็นโปรไฟล์)
                          </p>
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                          >
                            <Camera size={16} />
                            เลือกรูปเซลฟี่
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* 4) Selfie preview / loading / error / results */
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-4"
                  >
                    {preview && (
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
                            รูปเซลฟี่ที่เลือก
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-400">
                            {fileName}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={triggerSelfieSearch}
                              disabled={status === 'loading'}
                              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                            >
                              {status === 'loading' ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <SearchIcon size={16} />
                              )}
                              {status === 'loading' ? 'กำลังค้นหา…' : 'ตรวจสอบและค้นหา'}
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
                    )}

                    {/* Profile search loading (no selfie preview) */}
                    {!preview && status === 'loading' && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center gap-2.5 py-8 text-slate-400"
                      >
                        <Loader2 size={22} className="animate-spin text-brand-600" />
                        <span className="text-sm">{statusLabel}</span>
                      </motion.div>
                    )}

                    {/* Loading (selfie) */}
                    {preview && status === 'loading' && (
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
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2"
                      >
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                          {searchError}
                        </p>
                        {!preview && (
                          <button
                            type="button"
                            onClick={() => void runSearch(null)}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                          >
                            <SearchIcon size={16} />
                            ลองใหม่ด้วยใบหน้าโปรไฟล์
                          </button>
                        )}
                      </motion.div>
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
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">
                              พบ {results.length} ภาพ
                            </span>
                            {results.length > 0 && user &&
                              (!selectMode ? (
                                <button
                                  type="button"
                                  onClick={enterSelectMode}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                                >
                                  เลือกภาพ
                                </button>
                              ) : (
                                <>
                                  <span className="text-xs font-medium text-slate-500">
                                    {selected.size} ถูกเลือก
                                  </span>
                                  <button
                                    type="button"
                                    onClick={allSelected ? clearAll : selectAll}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                                  >
                                    <Check size={14} />
                                    {allSelected ? 'ล้างการเลือก' : 'เลือกทั้งหมด'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={downloadSelected}
                                    disabled={downloading || selected.size === 0}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                                  >
                                    {downloading ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Download size={14} />
                                    )}
                                    ดาวน์โหลด
                                  </button>
                                  <button
                                    type="button"
                                    onClick={exitSelectMode}
                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                                  >
                                    ยกเลิก
                                  </button>
                                </>
                              ))}
                            <button
                              type="button"
                              onClick={reset}
                              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-50"
                            >
                              ค้นใหม่
                            </button>
                          </div>
                        </div>
                        {results.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                            <p className="text-slate-500">ไม่พบภาพที่ตรง</p>
                            <p className="mt-1 text-sm text-slate-400">
                              ยังไม่มีภาพของคุณในอัลบั้มนี้
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                            {results.map((photo) => (
                              <div key={photo.id} className="relative">
                                <ImageCard
                                  photo={photo}
                                  onClick={openViewer}
                                  selectable={selectMode}
                                  selected={selected.has(photo.id)}
                                  onToggleSelect={toggleSelect}
                                />
                              </div>
                            ))}
                          </div>
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
