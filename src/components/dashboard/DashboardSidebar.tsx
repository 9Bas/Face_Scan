import { NavLink, Link } from 'react-router-dom'
import {
  Images,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  X,
} from 'lucide-react'
import { useAuth } from '../../auth'

const navItems = [
  { to: '/dashboard', label: 'ภาพรวม', icon: LayoutDashboard, end: true },
  { to: '/dashboard/albums', label: 'อัลบั้ม', icon: Images, end: false },
  { to: '/dashboard/account', label: 'บัญชี', icon: Settings, end: false },
]

interface DashboardSidebarProps {
  open: boolean
  onClose: () => void
}

export default function DashboardSidebar({ open, onClose }: DashboardSidebarProps) {
  const { user, signOut } = useAuth()

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!open}
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-xl transition-transform duration-300 lg:static lg:translate-x-0 lg:shadow-none lg:ring-1 lg:ring-slate-200',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Brand / close */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="inline-flex rounded-xl bg-brand-600 p-1.5 text-white">
              <LayoutDashboard size={18} />
            </span>
            <span className="text-base font-bold text-slate-900">แดชบอร์ด</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* User card */}
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-brand-50 px-3 py-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
              <User size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {user?.displayName ?? user?.email}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer actions */}
        <div className="border-t border-slate-100 px-3 py-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LayoutDashboard size={18} />
            กลับหน้าเว็บ
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={18} />
            ออกจากระบบ
          </button>
        </div>
      </aside>
    </>
  )
}