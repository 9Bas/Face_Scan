import type { IStorage, UploadResult } from './types'
import { supabase, supabaseConfigured } from '../supabaseClient'

/**
 * R2 storage via our Cloudflare Worker proxy.
 *
 * Worker endpoints (see worker/ folder):
 *   POST   /upload           multipart { albumId, file } + Bearer JWT
 *   DELETE /delete           json { storagePath, thumbnailPath } + Bearer JWT
 *   GET    /view?path=...    streams an object (public read, no auth)
 *
 * R2 secrets live only in the worker; the frontend just sends the Supabase JWT.
 */
const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? ''

async function bearer(): Promise<string> {
  if (!supabaseConfigured || !supabase) return ''
  const { data } = await (supabase as NonNullable<typeof supabase>).auth.getSession()
  return data.session?.access_token ?? ''
}

export const r2Storage: IStorage = {
  kind: 'r2',
  getViewUrl(storagePath: string): string {
    return `${WORKER_URL}/view?path=${encodeURIComponent(storagePath)}`
  },
  getThumbUrl(thumbnailPath: string | null): string | null {
    if (!thumbnailPath) return null
    return `${WORKER_URL}/view?path=${encodeURIComponent(thumbnailPath)}`
  },
  async uploadPhoto(file: File, albumId: string): Promise<UploadResult> {
    const fd = new FormData()
    fd.append('albumId', albumId)
    fd.append('file', file)
    const res = await fetch(`${WORKER_URL}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await bearer()}` },
      body: fd,
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`Upload failed (${res.status}): ${msg}`)
    }
    return (await res.json()) as UploadResult
  },
  async deletePhoto(storagePath: string, thumbnailPath: string | null): Promise<void> {
    const res = await fetch(`${WORKER_URL}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await bearer()}`,
      },
      body: JSON.stringify({ storagePath, thumbnailPath }),
    })
    if (!res.ok && res.status !== 404) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`Delete failed (${res.status}): ${msg}`)
    }
  },
}