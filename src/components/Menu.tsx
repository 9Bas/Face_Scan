import { Link } from 'react-router-dom'
import { LayoutDashboard, LogIn, LogOut, X } from 'lucide-react'
import { useAuth } from '../auth'

interface MenuProps {
  open: boolean
  onClose: () => void
}

export default function Menu({ open, onClose }: MenuProps) {
  const { user, signOut } = useAuth()

  const handleLogout = () => {
    void signOut()
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={[
          'fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!open}
      />

      {/* Drawer */}
      <aside
        className={[
          'fixed right-0 top-0 z-50 flex h-full w-[80%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        role="dialog"
        aria-label="Menu"
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <span className="text-sm font-semibold tracking-wide text-slate-500">
            เมนู
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mt-0">
            <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              แอคเคานต์
            </p>
            {user ? (
              <div className="space-y-1">
                <div className="rounded-xl bg-brand-50 px-3 py-3">
                  <p className="text-sm font-semibold text-brand-800">
                    {user.displayName ?? user.email}
                  </p>
                  <p className="truncate text-xs text-brand-600">{user.email}</p>
                </div>
                <Link
                  to="/dashboard"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  <LayoutDashboard size={20} className="text-brand-600" />
                  แดชบอร์ด
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut size={20} />
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                <LogIn size={20} className="text-brand-600" />
                เข้าสู่ระบบช่างภาพ
              </Link>
            )}
          </div>
        </div>

        {/* <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-400">
            Face Scan · PSRU Photo Gallery
          </p>
        </div> */}
      </aside>
    </>
  )
}