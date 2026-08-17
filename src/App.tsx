import { AnimatePresence, motion } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Header from './components/Header'
import { AuthProvider } from './auth'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Home from './pages/Home'
import Gallery from './pages/Gallery'
import Album from './pages/Album'
import Login from './pages/Login'
import DashboardLayout from './pages/DashboardLayout'
import Dashboard from './pages/Dashboard'
import DashboardAlbums from './pages/DashboardAlbums'
import DashboardAlbumDetail from './pages/DashboardAlbumDetail'
import DashboardAccount from './pages/DashboardAccount'

export default function App() {
  const location = useLocation()
  const isDashboard = location.pathname.startsWith('/dashboard')

  if (isDashboard) {
    return (
      <AuthProvider>
        <Routes location={location}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="albums" element={<DashboardAlbums />} />
            <Route path="albums/:albumId" element={<DashboardAlbumDetail />} />
            <Route path="account" element={<DashboardAccount />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    )
  }

  // Public layout: Header + page transitions + Footer
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-white">
        <Header />
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<Home />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/gallery/:albumId" element={<Album />} />
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </AuthProvider>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">This page doesn't exist.</p>
    </div>
  )
}