export type { IStorage, UploadResult } from './types'
export { mockStorage } from './mockStorage'
export { r2Storage } from './r2Storage'
export { supabaseStorage } from './supabaseStorage'
import { mockStorage } from './mockStorage'
import { r2Storage } from './r2Storage'
import { supabaseStorage } from './supabaseStorage'

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined

/**
 * Active storage provider.
 *   1. R2 via Cloudflare Worker  — when VITE_WORKER_URL is set
 *   2. Supabase Storage          — when a Supabase project is configured
 *   3. mock                       — dev fallback (no account yet)
 */
export const storage = WORKER_URL
  ? r2Storage
  : supabaseConfiguredFlag()
    ? supabaseStorage
    : mockStorage

function supabaseConfiguredFlag(): boolean {
  const u = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const k = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  return Boolean(u && k)
}