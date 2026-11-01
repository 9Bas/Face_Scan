import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { CheckCircle2, ImageUp, Loader2, ScanFace, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../../auth'
import { enrollProfileFace } from '../../lib/profileFaceService'
import { createThumbnail } from '../../lib/storage/thumbnail'

interface ProfilePhotoUploaderProps {
  /** New photo must match the existing profile face (PDPA guard). */
  verifyExisting: boolean
  submitLabel?: string
  /** Called after a successful save (the auth profile is already refreshed). */
  onSaved?: () => void
}

export default function ProfilePhotoUploader({
  verifyExisting,
  submitLabel,
  onSaved,
}: ProfilePhotoUploaderProps) {
  const { refreshProfile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
  }

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพ (JPG / PNG)')
      return
    }
    clearPreview()
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
    setError('')
    setSuccess('')
  }

  const reset = () => {
    clearPreview()
    setFile(null)
    setError('')
    setSuccess('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const submit = async () => {
    if (!file || saving) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      // Downscale to ≤1024px (keeps the face large enough for ArcFace) so we
      // don't ship 8–12 MB phone photos to the API or storage.
      let toSend = file
      try {
        const { blob } = await createThumbnail(file, 1024, 0.9)
        if (blob) {
          toSend = new File([blob], 'profile.jpg', { type: 'image/jpeg' })
        }
      } catch {
        /* send the original */
      }

      const result = await enrollProfileFace(toSend)
      await refreshProfile()
      setSuccess(
        result.replaced
          ? 'เปลี่ยนภาพโปรไฟล์เรียบร้อยแล้ว'
          : 'ตั้งภาพโปรไฟล์เรียบร้อยแล้ว',
      )
      setFile(null)
      clearPreview()
      if (inputRef.current) inputRef.current.value = ''
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตั้งภาพโปรไฟล์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onSelect}
      />

      {!preview ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-400 hover:bg-brand-50/50"
        >
          <span className="inline-flex rounded-2xl bg-white p-4 text-brand-600 shadow-sm ring-1 ring-slate-100">
            <ImageUp size={28} />
          </span>
          <span className="mt-4 text-base font-semibold text-slate-700">
            เลือกภาพโปรไฟล์
          </span>
          <span className="mt-1 text-sm text-slate-400">
            ต้องเห็นใบหน้าของคุณชัดเจน 1 คน (JPG / PNG)
          </span>
        </button>
      ) : (
        <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            <img
              src={preview}
              alt="ภาพโปรไฟล์ที่เลือก"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={reset}
              aria-label="ลบภาพที่เลือก"
              title="ลบภาพที่เลือก"
              className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white transition-colors hover:bg-slate-900"
            >
              <X size={13} />
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">
              {file?.name ?? 'ภาพโปรไฟล์'}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              ระบบจะตรวจพบใบหน้าและบันทึกเป็นตัวตนของคุณ
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
            >
              เปลี่ยนภาพ
            </button>
          </div>
        </div>
      )}

      {verifyExisting && (
        <div className="flex gap-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
          <ShieldCheck size={16} className="mt-0.5 shrink-0" />
          <p>
            เพื่อความปลอดภัยของเจ้าของข้อมูล (PDPA) ภาพใหม่ต้องเป็นใบหน้าเดียวกันกับ
            ภาพโปรไฟล์เดิมเท่านั้น
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!file || saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <ScanFace size={18} />
        )}
        {saving
          ? 'กำลังตรวจสอบใบหน้า…'
          : submitLabel ?? (verifyExisting ? 'ตรวจสอบและเปลี่ยนภาพ' : 'บันทึกภาพโปรไฟล์')}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {success && (
        <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          <CheckCircle2 size={16} />
          {success}
        </p>
      )}
    </div>
  )
}
