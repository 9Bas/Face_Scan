import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import type { AlbumCategory } from '../../lib/types'

/** Today as a local `YYYY-MM-DD` string (default when creating a new album). */
function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Normalize a date value to a Gregorian `YYYY-MM-DD` (a year >= 2400 is treated as พ.ศ.). */
function normalizeYmd(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return ''
  let year = Number(m[1])
  if (year >= 2400) year -= 543
  if (year < 1900 || year > 2200) return ''
  return `${String(year).padStart(4, '0')}-${m[2]}-${m[3]}`
}

export interface AlbumFormValues {
  name: string
  description: string
  event_date: string
  location: string
  category: AlbumCategory | ''
}

interface AlbumFormDialogProps {
  open: boolean
  initial?: Partial<AlbumFormValues>
  mode: 'create' | 'edit'
  loading?: boolean
  onSubmit: (values: AlbumFormValues) => void
  onClose: () => void
}

const categoryOptions: { value: AlbumCategory | ''; label: string }[] = [
  { value: '', label: 'ไม่ระบุ' },
  { value: 'sports', label: 'กีฬา' },
  { value: 'academic', label: 'วิชาการ' },
  { value: 'activities', label: 'กิจกรรม' },
  { value: 'culture', label: 'วัฒนธรรม' },
]

export default function AlbumFormDialog({
  open,
  initial,
  mode,
  loading,
  onSubmit,
  onClose,
}: AlbumFormDialogProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [category, setCategory] = useState<AlbumCategory | ''>(
    (initial?.category as AlbumCategory | '') ?? '',
  )

  // Sync form fields with `initial` whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setEventDate(initial?.event_date || (mode === 'create' ? todayLocal() : ''))
    setLocation(initial?.location ?? '')
    setCategory((initial?.category as AlbumCategory | '') ?? '')
  }, [open, initial, mode])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      event_date: normalizeYmd(eventDate),
      location: location.trim(),
      category,
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={mode === 'create' ? 'สร้างอัลบั้ม' : 'แก้ไขอัลบั้ม'}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {mode === 'create' ? 'สร้างอัลบั้มใหม่' : 'แก้ไขอัลบั้ม'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="ปิด"
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                <Field label="ชื่ออัลบั้ม" required>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="เช่น PSRU Freshy 2025"
                    className="input"
                  />
                </Field>

                <Field label="คำอธิบาย">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="รายละเอียดสั้นๆ ของอัลบั้ม"
                    className="input resize-none"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="วันที่จัดงาน">
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="input"
                    />
                  </Field>
                  <Field label="สถานที่">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="เช่น หอประชุม PSRU"
                      className="input"
                    />
                  </Field>
                </div>

                <Field label="หมวดหมู่">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as AlbumCategory | '')}
                    className="input"
                  >
                    {categoryOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  {loading && <Loader2 size={15} className="animate-spin" />}
                  {mode === 'create' ? 'สร้างอัลบั้ม' : 'บันทึก'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}