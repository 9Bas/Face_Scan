import { useAuth } from '../auth'
import { PageFade } from '../components/motion'
import { Mail, ShieldCheck, User as UserIcon } from 'lucide-react'

export default function DashboardAccount() {
  const { user } = useAuth()

  return (
    <PageFade className="max-w-2xl">
      <h2 className="text-xl font-bold text-slate-900">ข้อมูลช่างภาพ</h2>
      <p className="mt-1 text-sm text-slate-500">โปรไฟล์</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 bg-gradient-to-br from-brand-600 to-brand-700 px-6 py-6 text-white">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            <UserIcon size={26} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">
              {user?.displayName ?? 'ไม่ระบุชื่อ'}
            </p>
            <p className="truncate text-sm text-white/80">{user?.email}</p>
          </div>
        </div>

        <dl className="divide-y divide-slate-100 px-6 py-2">
          {/*<Row icon={<UserIcon size={16} />} label="รหัสผู้ใช้" value={user?.id ?? '-'} /> */}
          <Row
            icon={<Mail size={16} />}
            label="อีเมล"
            value={user?.email ?? '-'}
          />
          <Row
            icon={<ShieldCheck size={16} />}
            label="บทบาท"
            value={
              user?.role === 'admin'
                ? 'ผู้ดูแลระบบ'
                : 'ช่างภาพ (Photographer)'
            }
          />
        </dl>
      </div>
    </PageFade>
  )
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="inline-flex rounded-lg bg-slate-100 p-1.5 text-slate-500">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </dt>
        <dd className="truncate text-sm font-semibold text-slate-800 break-all">
          {value}
        </dd>
      </div>
    </div>
  )
}