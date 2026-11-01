import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, ScanFace, ShieldCheck } from 'lucide-react'
import { useAuth } from '../auth'
import { PageFade } from '../components/motion'
import ProfilePhotoUploader from '../components/profile/ProfilePhotoUploader'
import { profileAvatarUrl } from '../lib/profileFaceService'

export default function SetupProfile() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [saved, setSaved] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        กำลังโหลด…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const enrolled = user.faceEnrolled !== false && Boolean(user.avatarPath)
  const avatarUrl = profileAvatarUrl(user.avatarPath)

  return (
    <PageFade className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-700"
      >
        <ArrowLeft size={16} />
        กลับหน้าหลัก
      </Link>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-7 text-white">
          <span className="inline-flex rounded-2xl bg-white/15 p-2.5">
            <ScanFace size={24} />
          </span>
          <h1 className="mt-3 text-xl font-bold sm:text-2xl">
            {enrolled ? 'ภาพโปรไฟล์ของคุณ' : 'ตั้งภาพโปรไฟล์'}
          </h1>
          <p className="mt-1 text-sm text-white/85">
            {enrolled
              ? 'เปลี่ยนภาพโปรไฟล์ได้ แต่ต้องเป็นใบหน้าเดิมของเจ้าของบัญชี'
              : 'จำเป็นต้องตั้งภาพโปรไฟล์ก่อนใช้งานการค้นหาด้วยใบหน้า'}
          </p>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-6">
          {enrolled && avatarUrl && (
            <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
              <img
                src={avatarUrl}
                alt="ภาพโปรไฟล์ปัจจุบัน"
                className="h-20 w-20 rounded-full object-cover ring-2 ring-white"
              />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                  <BadgeCheck size={16} className="text-emerald-600" />
                  ยืนยันใบหน้าแล้ว
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
          )}

          {!enrolled && (
            <div className="flex gap-3 rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-800 ring-1 ring-brand-100">
              <ShieldCheck size={16} className="mt-0.5 shrink-0" />
              <p>
                ระบบใช้ใบหน้าในภาพนี้เป็นตัวตนของคุณ เพื่อให้ค้นหาและดาวน์โหลดได้
                เฉพาะภาพที่มีใบหน้าของคุณเอง — ไม่ใช้ใบหน้าของผู้อื่น (PDPA)
              </p>
            </div>
          )}

          <ProfilePhotoUploader
            verifyExisting={enrolled}
            submitLabel={enrolled ? 'เปลี่ยนภาพโปรไฟล์' : 'บันทึกภาพโปรไฟล์'}
            onSaved={() => setSaved(true)}
          />

          {saved && enrolled && (
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 sm:w-auto"
            >
              เริ่มค้นหาภาพของฉัน
            </Link>
          )}
        </div>
      </div>
    </PageFade>
  )
}
