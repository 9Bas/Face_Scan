import { Menu } from 'lucide-react'
import { useAuth } from '../../auth'

interface DashboardHeaderProps {
  title: string
  subtitle?: string
  onMenu: () => void
}

export default function DashboardHeader({
  title,
  subtitle,
  onMenu,
}: DashboardHeaderProps) {
  const { user } = useAuth()
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="เปิดเมนู"
        className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
      >
        <Menu size={22} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
          {title}
        </h1>
        {subtitle && (
          <p className="truncate text-xs text-slate-500 sm:text-sm">{subtitle}</p>
        )}
      </div>

      <span className="hidden text-xs font-medium text-slate-400 sm:inline">
        {user?.displayName ?? user?.email}
      </span>
    </header>
  )
}