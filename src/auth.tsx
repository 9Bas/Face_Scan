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
  /** Storage path of the profile photo (null when not set yet). */
  avatarPath: string | null
  /**
   * Whether a profile face is enrolled. `null` means "unknown" — e.g. the
   * 0009 migration hasn't been applied yet — so the UI can avoid locking
   * people out of the site.
   */
  faceEnrolled: boolean | null
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AppUser>
  signUp: (email: string, password: string, displayName?: string) => Promise<AppUser>
  signOut: () => Promise<void>
  /** Re-read the profile + enrollment flag (after changing the profile photo). */
  refreshProfile: () => Promise<void>
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
    avatar_path: null,
    created_at: new Date().toISOString(),
  }
}

interface ProfileBundle {
  profile: Profile | null
  faceEnrolled: boolean | null
}

/**
 * Load the caller's profile + profile-face enrollment state.
 *
 * The profile is read via the RPC `get_my_profile()` (security definer, which
 * also auto-creates the row when missing). `avatar_path` and `has_profile_face`
 * come from migration 0009; if that migration hasn't been applied yet we fall
 * back gracefully instead of blocking the app.
 */
async function loadProfile(
  sb: NonNullable<typeof supabase>,
  uid: string,
): Promise<ProfileBundle> {
  let profile: Profile | null = null

  if (uid) {
    const { data: rpcRow, error: rpcErr } = await sb.rpc('get_my_profile')
    if (!rpcErr) profile = (rpcRow as Profile | null) ?? null
  }

  if (!profile) {
    // Fallback to a direct select — works when RLS allows it.
    const { data: row, error } = await sb
      .from('profiles')
      .select('id,email,display_name,role,created_at,avatar_path')
      .eq('id', uid)
      .maybeSingle()
    if (error) {
      const { data: basic, error: err2 } = await sb
        .from('profiles')
        .select('id,email,display_name,role,created_at')
        .eq('id', uid)
        .maybeSingle()
      if (err2) throw err2
      profile = basic as Profile | null
    } else {
      profile = row as Profile | null
    }
  }

  // avatar_path may be missing from the get_my_profile() result set — read it
  // directly (tolerate the column not existing yet).
  let avatarPath = profile?.avatar_path ?? null
  if (profile) {
    const { data: extra, error: extraErr } = await sb
      .from('profiles')
      .select('avatar_path')
      .eq('id', uid)
      .maybeSingle()
    if (!extraErr && extra) {
      avatarPath = (extra as { avatar_path: string | null }).avatar_path ?? null
    }
    profile = { ...profile, avatar_path: avatarPath }
  }

  // null = RPC missing (migration not applied) → don't enforce the gate.
  let faceEnrolled: boolean | null = null
  const { data: flag, error: flagErr } = await sb.rpc('has_profile_face')
  if (!flagErr) faceEnrolled = Boolean(flag)

  return { profile, faceEnrolled }
}

function toAppUser(
  user: SupabaseUser,
  profile: Profile | null,
  faceEnrolled: boolean | null = null,
): AppUser | null {
  if (!profile) return null
  return {
    id: user.id,
    email: user.email ?? profile.email ?? '',
    displayName: profile.display_name,
    role: profile.role,
    avatarPath: profile.avatar_path ?? null,
    faceEnrolled,
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
          const bundle = await loadProfile(sb, data.session.user.id)
          if (active) {
            setUser(toAppUser(data.session.user, bundle.profile, bundle.faceEnrolled))
          }
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
          const bundle = await loadProfile(sb, sess.user.id)
          setUser(toAppUser(sess.user, bundle.profile, bundle.faceEnrolled))
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
      const bundle = await loadProfile(sb, data.session!.user.id)
      const u = toAppUser(data.session!.user, bundle.profile, bundle.faceEnrolled)
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
      // The DB trigger `handle_new_user()` creates the profile with role 'user'
      // (and a guard trigger blocks clients from changing roles). We only sync
      // the display name — an upsert would need an INSERT policy (there isn't
      // one), so update the row the trigger already created instead.
      try {
        const { error: syncErr } = await sb
          .from('profiles')
          .update({
            email: normalizedEmail,
            display_name: displayName?.trim() || normalizedEmail.split('@')[0],
          })
          .eq('id', data.user.id)
        if (syncErr) console.error('sync profile failed:', syncErr.message)
      } catch (e) {
        console.error('sync profile failed:', e)
      }
      const bundle = await loadProfile(sb, data.user.id)
      const u = toAppUser(data.user, bundle.profile, bundle.faceEnrolled)
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

  const refreshProfile = async (): Promise<void> => {
    if (!supabaseConfigured || !supabase) return
    const sb = supabase as NonNullable<typeof supabase>
    const { data } = await sb.auth.getUser()
    if (!data.user) return
    try {
      const bundle = await loadProfile(sb, data.user.id)
      setUser(toAppUser(data.user, bundle.profile, bundle.faceEnrolled))
    } catch (e) {
      console.error('refreshProfile failed:', e)
    }
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}