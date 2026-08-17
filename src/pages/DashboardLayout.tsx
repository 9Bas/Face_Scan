import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import DashboardHeader from '../components/dashboard/DashboardHeader'

const titles: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': {
    title: 'ภาพรวม',
    subtitle: 'อัลบั้มและรูปภาพทั้งหมด',
  },
  '/dashboard/albums': { title: 'อัลบั้ม', subtitle: 'จัดการอัลบั้มของคุณ' },
  '/dashboard/account': { title: 'บัญชี', subtitle: 'ข้อมูลช่างภาพ' },
}

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  // Detail route like /dashboard/albums/abc -> title "อัลบั้ม"
  const base = Object.keys(titles).find((k) =>
    location.pathname.startsWith(k),
  )
  const meta =
    titles[base ?? '/dashboard'] ?? titles['/dashboard']

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <DashboardSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          title={meta.title}
          subtitle={meta.subtitle}
          onMenu={() => setMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}