import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, X } from 'lucide-react'
import { PageFade } from '../components/motion'
import { useAuth } from '../auth'
import {
  listDeletionRequests,
  updateDeletionRequestStatus,
  type PhotoDeletionRequestDTO,
} from '../lib/deletionRequestService'
import ConfirmDialog from '../components/dashboard/ConfirmDialog'

export default function DashboardRequests() {
  const { user } = useAuth()
  const [requests, setRequests] = useState<PhotoDeletionRequestDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [approveTarget, setApproveTarget] = useState<PhotoDeletionRequestDTO | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await listDeletionRequests('pending')
      setRequests(data)
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleApprove = async () => {
    if (!approveTarget || !user) return
    setProcessing(approveTarget.id)
    try {
      await updateDeletionRequestStatus(
        approveTarget.id,
        'approved',
        user.id,
        approveTarget.photo
          ? {
              id: approveTarget.photo.id,
              album_id: approveTarget.album_id ?? approveTarget.photo.album_id,
              storage_path: (approveTarget.photo as any).storage_path,
              thumbnail_path: (approveTarget.photo as any).thumbnail_path,
            }
          : undefined,
      )
      setApproveTarget(null)
      await load()
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async (req: PhotoDeletionRequestDTO) => {
    if (!user) return
    setProcessing(req.id)
    try {
      await updateDeletionRequestStatus(req.id, 'rejected', user.id)
      await load()
    } finally {
      setProcessing(null)
    }
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

  return (
    <PageFade>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">คำขอลบรูปภาพ</h1>
          <p className="mt-1 text-sm text-slate-500">คำขอที่รอการอนุมัติ</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-500">
          ไม่มีคำขอลบรูปที่รอดำเนินการ
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
            >
              <div className="h-32 w-full overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-36">
                {req.photo?.thumb_url || req.photo?.url ? (
                  <img
                    src={req.photo.thumb_url ?? req.photo.url}
                    alt={req.photo.filename}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragStart={(e) => e.preventDefault()}
                    draggable={false}
                    className="h-full w-full object-cover select-none"
                    style={{ WebkitTouchCallout: 'none' }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-300">ไม่มีรูป</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {req.photo?.filename ?? req.photo_id}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ขอโดย: {req.requester_email ?? req.requester_id}
                </p>
                {req.reason && (
                  <p className="mt-1 text-xs text-slate-500">เหตุผล: {req.reason}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  เมื่อ: {new Date(req.created_at).toLocaleString('th-TH')}
                </p>
                {req.photo?.album_id || req.album_id ? (
                  <Link
                    to={`/gallery/${req.photo?.album_id ?? req.album_id}`}
                    className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline"
                  >
                    ดูในอัลบั้ม
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApproveTarget(req)}
                  disabled={processing === req.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {processing === req.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  อนุมัติและลบ
                </button>
                <button
                  type="button"
                  onClick={() => void handleReject(req)}
                  disabled={processing === req.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <X size={14} />
                  ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!approveTarget}
        title="อนุมัติคำขอลบรูป"
        message="การอนุมัติจะลบรูปนี้ออกจากระบบถาวร"
        destructive
        confirmLabel="อนุมัติและลบ"
        loading={processing === approveTarget?.id}
        onConfirm={handleApprove}
        onCancel={() => setApproveTarget(null)}
      />
    </PageFade>
  )
}
