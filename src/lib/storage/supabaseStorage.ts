import { supabase, supabaseConfigured } from '../supabaseClient'
import type { IStorage, UploadResult } from './types'
import { createThumbnail } from './thumbnail'

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
  async uploadPhoto(file: File, albumId: string, _signal?: AbortSignal): Promise<UploadResult> {
    if (!supabaseConfigured || !supabase) {
      // mock path — no real upload
      const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      return {
        storagePath: `albums/${albumId}/original/${name}.jpg`,
        thumbnailPath: `albums/${albumId}/thumbs/${name}.jpg`,
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

    // Generate + store a client-side thumbnail so grids render immediately.
    // Single decode — dimensions come back from the same pass.
    const { blob: thumb, width, height } = await createThumbnail(file)
    let thumbnailPath: string | null = null
    if (thumb) {
      const thumbPath = path.replace('/original/', '/thumbs/')
      const { error: thumbErr } = await sb.storage
        .from(BUCKET)
        .upload(thumbPath, thumb, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      if (!thumbErr) thumbnailPath = thumbPath
    }

    return {
      storagePath: path,
      thumbnailPath,
      fileSize: file.size,
      mimeType: file.type || 'image/jpeg',
      width: width || undefined,
      height: height || undefined,
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