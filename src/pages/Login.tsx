import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Camera,
  Lock,
  Mail,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '../auth'
import { supabaseConfigured } from '../lib/supabaseClient'
import { PageFade } from '../components/motion'

export default function Login() {
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'login' | 'register'>(
    (location.state as { register?: boolean } | null)?.register ? 'register' : 'login'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? (mode === 'register' ? '/' : '/dashboard')

  if (user || redirecting) return <Navigate to={from} replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const loggedIn = await signIn(email.trim(), password)
        setRedirecting(true)
        const dest = loggedIn.role === 'user' ? '/' : '/dashboard'
        navigate(dest, { replace: true })
      } else {
        if (!email.trim().toLowerCase().endsWith('@psru.ac.th')) {
          throw new Error('อนุญาตให้สมัครด้วยอีเมล @psru.ac.th เท่านั้น')
        }
        await signUp(email.trim(), password, displayName)
        setSuccess('สมัครสมาชิกสำเร็จ')
        setRedirecting(true)
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ดำเนินการไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageFade>
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-brand-700"
        >
          <ArrowLeft size={18} />
          กลับหน้าหลัก
        </Link>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-8 py-8 text-white">
            <span className="inline-flex rounded-2xl bg-white/15 p-3">
              {mode === 'login' ? <Camera size={26} /> : <UserPlus size={26} />}
            </span>
            <h1 className="mt-4 text-2xl font-bold">
              {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {mode === 'login' ? 'เข้าสู่ระบบเพื่อใช้งาน' : 'สำหรับสมาชิก (ต้องใช้อีเมล @psru.ac.th)'}
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {!supabaseConfigured && (
              <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                ยังไม่ได้ตั้งค่า Supabase — โหมดทดลอง (mock) กรอก
                email/รหัสผ่านอะไรก็ได้เพื่อเข้าสู่ระบบ
              </p>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor="displayName" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    ชื่อที่แสดง
                  </label>
                  <div className="relative">
                    <input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="ชื่อของคุณ"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  อีเมล
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@psru.ac.th"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  />
                </div>
                {mode === 'register' && (
                  <p className="mt-1 text-xs text-slate-500">ต้องเป็นอีเมลที่ลงท้ายด้วย @psru.ac.th เท่านั้น</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    id="password"
                    type={mode === 'login' ? 'password' : 'text'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100"
                  />
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600"
                >
                  {error}
                </motion.p>
              )}
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600"
                >
                  {success}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {mode === 'login' ? 'กำลังเข้าสู่ระบบ…' : 'กำลังสมัคร…'}
                  </span>
                ) : (
                  <>
                    {mode === 'login' ? <Lock size={16} /> : <UserPlus size={16} />}
                    {mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center text-sm text-slate-600">
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register')
                    setError('')
                    setSuccess('')
                  }}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  ยังไม่มีบัญชี? สมัครสมาชิก
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                    setSuccess('')
                  }}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageFade>
  )
}