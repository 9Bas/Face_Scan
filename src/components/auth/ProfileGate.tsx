import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth'

/**
 * Forces signed-in members (role `user`) to set a profile photo + enrolled
 * face before using the site. Staff accounts are not blocked here (they keep
 * dashboard access); they are prompted only when they try face search.
 */
export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <>{children}</>

  const needsProfile =
    user?.role === 'user' &&
    user.faceEnrolled === false &&
    location.pathname !== '/setup-profile'

  if (needsProfile) {
    return <Navigate to="/setup-profile" replace />
  }

  return <>{children}</>
}
