import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabaseClient'
import type { Profile } from './lib/types'

export interface AppUser {
  id: string
  email: string
  displayName: string | null
  role: Profile['role']
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AppUser>
  signUp: (email: string, password: string, displayName?: string) => Promise<AppUser>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ---- Mock auth (dev fallback when Supabase isn't configured) ----
const MOCK_KEY = 'facescan_mock_session'
async function mockLoadProfile(uid: string): Promise<Profile> {
  return {
    id: uid,
    email: 'photographer@psru.ac.th',
    display_name: 'PSRU Photographer (demo)',
    role: 'photographer',
    created_at: new Date().toISOString(),
  }
}

/**
 * Fetch the caller's profile via the RPC `get_my_profile()` (security definer).
 * Avoids RLS 403s when a policy isn't applied as expected. Auto-creates a
 * profile row when missing.
 */
async function fetchProfile(sb: NonNullable<typeof supabase>): Promise<Profile | null> {
  const { data, error } = await sb.rpc('get_my_profile')
  if (error) {
    // Fallback to direct select — works if RLS policy eventually allows it.
    const { data: row, error: err2 } = await sb
      .from('profiles')
      .select('*')
      .maybeSingle()
    if (err2) throw err2
    return row as Profile | null
  }
  return data as Profile | null
}

function toAppUser(user: SupabaseUser, profile: Profile | null): AppUser | null {
  if (!profile) return null
  return {
    id: user.id,
    email: user.email ?? profile.email ?? '',
    displayName: profile.display_name,
    role: profile.role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function bootstrap() {
      // MOCK path -------------------------------------------------
      if (!supabaseConfigured || !supabase) {
        try {
          const raw = localStorage.getItem(MOCK_KEY)
          if (raw) {
            const uid = JSON.parse(raw) as string
            const p = await mockLoadProfile(uid)
            if (active) {
              const fakeUser = { id: uid } as SupabaseUser
              setUser(toAppUser(fakeUser, p))
            }
          }
        } catch { /* ignore */ }
        if (active) setLoading(false)
        return
      }

      // REAL path -------------------------------------------------
      const sb = supabase as NonNullable<typeof supabase>
      const { data } = await sb.auth.getSession()
      if (data.session?.user) {
        try {
          const prof = await fetchProfile(sb)
          if (active) setUser(toAppUser(data.session.user, prof))
        } catch {
          if (active) setUser(null)
        }
      }
      if (active) setLoading(false)

      const { data: sub } = sb.auth.onAuthStateChange(async (_evt, sess) => {
        if (!sess?.user) {
          setUser(null)
          return
        }
        try {
          const prof = await fetchProfile(sb)
          setUser(toAppUser(sess.user, prof))
        } catch {
          setUser(null)
        }
      })
      return () => { sub.subscription.unsubscribe() }
    }

    bootstrap()
    return () => { active = false }
  }, [])

  const signIn = async (email: string, password: string): Promise<AppUser> => {
    setLoading(true)
    try {
      // MOCK path
      if (!supabaseConfigured || !supabase) {
        await new Promise((r) => setTimeout(r, 500))
        if (!email || !password) throw new Error('กรุณากรอก email และรหัสผ่าน')
        const normalizedEmail = email.trim().toLowerCase()
        const uid = 'mock-' + btoa(normalizedEmail).slice(0, 12)
        localStorage.setItem(MOCK_KEY, JSON.stringify(uid))
        const p: Profile = {
          id: uid,
          email: normalizedEmail,
          display_name: normalizedEmail.split('@')[0],
          role: normalizedEmail === 'admin@psru.ac.th' ? 'admin' : (normalizedEmail.includes('photographer') ? 'photographer' : 'user'),
          created_at: new Date().toISOString(),
        }
        const u = toAppUser({ id: uid, email: normalizedEmail } as SupabaseUser, p)
        if (!u) throw new Error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ')
        setUser(u)
        return u
      }

      // REAL path
      const sb = supabase as NonNullable<typeof supabase>
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error } = await sb.auth.signInWithPassword({ email: normalizedEmail, password })
      if (error) throw new Error('ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง')
      const prof = await fetchProfile(sb)
      const u = toAppUser(data.session!.user, prof)
      if (!u) throw new Error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ')
      setUser(u)
      return u
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string, displayName?: string): Promise<AppUser> => {
    setLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail.endsWith('@psru.ac.th')) {
        throw new Error('อนุญาตให้สมัครด้วยอีเมล @psru.ac.th เท่านั้น')
      }

      if (!supabaseConfigured || !supabase) {
        await new Promise((r) => setTimeout(r, 500))
        if (!password) throw new Error('กรุณากรอกรหัสผ่าน')
        const uid = 'mock-' + btoa(normalizedEmail).slice(0, 12)
        localStorage.setItem(MOCK_KEY, JSON.stringify(uid))
        const p: Profile = {
          id: uid,
          email: normalizedEmail,
          display_name: displayName?.trim() || normalizedEmail.split('@')[0],
          role: 'user',
          created_at: new Date().toISOString(),
        }
        const u = toAppUser({ id: uid, email: normalizedEmail } as SupabaseUser, p)
        if (!u) throw new Error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ')
        setUser(u)
        return u
      }

      const sb = supabase as NonNullable<typeof supabase>
      const { data, error } = await sb.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: undefined,
          data: {
            display_name: displayName?.trim() || normalizedEmail.split('@')[0],
          },
        },
      })
      if (error) {
        const msg = error.message.toLowerCase()
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
          throw new Error('อีเมลนี้ถูกใช้งานแล้ว')
        }
        if (msg.includes('signups not allowed')) {
          throw new Error('ปิดการสมัครสมาชิกในระบบนี้ กรุณาเปิด "Allow new users to sign up" ใน Supabase Auth')
        }
        if (msg.includes('invalid')) {
          throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
        }
        throw new Error(error.message)
      }
      if (!data.user) throw new Error('สมัครสมาชิกไม่สำเร็จ')
      // Force set role to user (in case trigger/profile exists with different role)
      try {
        await sb.from('profiles').upsert(
          {
            id: data.user.id,
            email: normalizedEmail,
            display_name: displayName?.trim() || normalizedEmail.split('@')[0],
            role: 'user',
          },
          { onConflict: 'id' }
        )
      } catch (e) {
        console.error('upsert profile failed:', e)
      }
      try {
        await sb.from('profiles').update({ role: 'user' }).eq('id', data.user.id)
      } catch (e) {
        console.error('update profile role failed:', e)
      }
      const prof = await fetchProfile(sb)
      const u = toAppUser(data.user, prof)
      if (!u) throw new Error('โหลดข้อมูลผู้ใช้ไม่สำเร็จ')
      setUser(u)
      return u
    } finally {
      setLoading(false)
    }
  }

  const signOut = async (): Promise<void> => {
    if (!supabaseConfigured || !supabase) {
      localStorage.removeItem(MOCK_KEY)
      setUser(null)
      return
    }
    const sb = supabase as NonNullable<typeof supabase>
    await sb.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}