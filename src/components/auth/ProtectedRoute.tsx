import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth'
import { Loader2 } from 'lucide-react'

/**
 * Wraps a photographer-only route. Redirects to /login when signed out,
 * shows a small spinner while the session is resolving.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}