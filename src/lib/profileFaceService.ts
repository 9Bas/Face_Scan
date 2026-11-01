/**
 * Profile face service — enrolls the member's profile photo and searches
 * using the stored profile face.
 *
 * All calls require a signed-in Supabase session (Authorization: Bearer …).
 * The backend derives the user id from that token, so the client can never
 * enroll or search on behalf of another member.
 */

import { supabase, supabaseConfigured } from './supabaseClient'
import { storage } from './storage'
import {
  FaceSearchError,
  apiUrl,
  mapFaceSearchResult,
  type FaceSearchResult,
} from './faceSearchService'

export interface EnrollProfileResult {
  avatarPath: string
  replaced: boolean
}

export interface ProfileSearchOptions {
  albumId?: string | null
  /** Optional selfie — the backend verifies it matches the profile face. */
  file?: File | null
  maxDistance?: number
  topK?: number
}

/** Public URL for a stored avatar path (R2 worker or Supabase Storage). */
export function profileAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null
  return storage.getViewUrl(avatarPath)
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!supabaseConfigured || !supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function errorMessage(detail: unknown, status: number, fallback: string): string {
  if (typeof detail === 'string' && detail.trim()) return detail
  if (status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'
  if (status === 403) return 'ใบหน้านี้ไม่ตรงกับโปรไฟล์ของคุณ'
  if (status === 409) return 'ยังไม่ได้ตั้งภาพโปรไฟล์ กรุณาตั้งภาพโปรไฟล์ก่อน'
  if (status === 422) return 'ไม่พบใบหน้าที่ชัดเจนในภาพ กรุณาใช้ภาพอื่น'
  if (status === 502) return 'อัปโหลดภาพไม่สำเร็จ ลองอีกครั้ง'
  return fallback
}

/**
 * Enroll (or replace) the signed-in member's profile photo.
 *
 * The backend always requires a new photo to match the existing profile face,
 * so identity swaps are impossible even if this client is tampered with.
 */
export async function enrollProfileFace(file: File): Promise<EnrollProfileResult> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    throw new FaceSearchError('กรุณาเข้าสู่ระบบก่อนตั้งภาพโปรไฟล์', 401)
  }

  const fd = new FormData()
  fd.append('file', file)

  let resp: Response
  try {
    resp = await fetch(apiUrl('/api/faces/profile/enroll'), {
      method: 'POST',
      headers,
      body: fd,
    })
  } catch {
    throw new FaceSearchError('เชื่อมต่อเซิร์ฟเวอร์ AI ไม่ได้ ลองอีกครั้ง', 0)
  }

  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new FaceSearchError(
      errorMessage(body?.detail, resp.status, 'ตั้งภาพโปรไฟล์ไม่สำเร็จ'),
      resp.status,
    )
  }
  return {
    avatarPath: String(body?.avatar_path ?? ''),
    replaced: Boolean(body?.replaced),
  }
}

/**
 * Search photos using the member's OWN profile face.
 *
 * Passing a selfie is optional — it is verified against the profile face and
 * then discarded; the search always uses the stored profile embedding, so the
 * results can only ever be photos of the account owner.
 */
export async function searchByProfileFace(
  opts: ProfileSearchOptions = {},
): Promise<FaceSearchResult[]> {
  const headers = await authHeaders()
  if (!headers.Authorization) {
    throw new FaceSearchError('กรุณาเข้าสู่ระบบก่อนค้นหาด้วยใบหน้า', 401)
  }

  const params = new URLSearchParams()
  if (opts.maxDistance != null) params.set('max_distance', String(opts.maxDistance))
  if (opts.topK != null) params.set('top_k', String(opts.topK))
  if (opts.albumId) params.set('album_id', opts.albumId)

  const fd = new FormData()
  if (opts.file) fd.append('file', opts.file)

  let resp: Response
  try {
    resp = await fetch(
      apiUrl(`/api/faces/profile/search?${params.toString()}`),
      { method: 'POST', headers, body: fd },
    )
  } catch {
    throw new FaceSearchError('เชื่อมต่อเซิร์ฟเวอร์ AI ไม่ได้ ลองอีกครั้ง', 0)
  }

  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new FaceSearchError(
      errorMessage(body?.detail, resp.status, 'ค้นหาไม่สำเร็จ'),
      resp.status,
    )
  }

  const rows = (body?.results ?? []) as Array<{
    photo_id: string
    album_id: string
    filename: string
    storage_path: string
    thumbnail_path: string | null
    face_id: string
    face_index: number
    bbox_x: number
    bbox_y: number
    bbox_width: number
    bbox_height: number
    distance: number
    similarity?: number
  }>

  return rows.map((r) => mapFaceSearchResult(r))
}
