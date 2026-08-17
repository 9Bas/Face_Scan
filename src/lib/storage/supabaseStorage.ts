import { supabase, supabaseConfigured } from '../supabaseClient'
import type { IStorage, UploadResult } from './types'

const BUCKET = 'photos'

/**
 * Supabase Storage adapter — free 1GB bucket.
 * Reuses the same path layout as R2 (albums/{albumId}/original/{file})
 * so migrating to R2+Worker later only needs swapping the provider, not
 * changing paths or UI code.
 */
export const supabaseStorage: IStorage = {
  kind: 'mock', // keep 'mock' tag for now; treated as real below
  getViewUrl(storagePath: string): string {
    if (!supabaseConfigured || !supabase) {
      // dev fallback (no bucket) — return a tiny transparent placeholder
      return `https://picsum.photos/seed/${encodeURIComponent(storagePath)}/1000/750`
    }
    const sb = supabase as NonNullable<typeof supabase>
    const { data } = sb.storage.from(BUCKET).getPublicUrl(storagePath)
    return data.publicUrl
  },
  getThumbUrl(thumbnailPath: string | null): string | null {
    if (!thumbnailPath) return null
    return this.getViewUrl(thumbnailPath)
  },
  async uploadPhoto(file: File, albumId: string): Promise<UploadResult> {
    if (!supabaseConfigured || !supabase) {
      // mock path — no real upload
      const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      return {
        storagePath: `albums/${albumId}/original/${name}.jpg`,
        thumbnailPath: null,
        fileSize: file.size,
        mimeType: file.type || 'image/jpeg',
      }
    }
    const sb = supabase as NonNullable<typeof supabase>
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e6)}-${file.name.replace(/[^\w.-]/g, '_')}`
    const path = `albums/${albumId}/original/${safeName}`
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
    if (error) throw new Error(`Upload to Supabase failed: ${error.message}`)
    return {
      storagePath: path,
      thumbnailPath: null,
      fileSize: file.size,
      mimeType: file.type || 'image/jpeg',
    }
  },
  async deletePhoto(storagePath: string, thumbnailPath: string | null): Promise<void> {
    if (!supabaseConfigured || !supabase) return
    const sb = supabase as NonNullable<typeof supabase>
    const paths = [storagePath]
    if (thumbnailPath) paths.push(thumbnailPath)
    const { error } = await sb.storage.from(BUCKET).remove(paths)
    if (error) throw new Error(`Delete from Supabase failed: ${error.message}`)
  },
}