/**
 * Face Search service — calls the Python AI backend (InsightFace / ArcFace).
 *
 * In dev, Vite proxies /api → VITE_FACE_API_URL (see vite.config.ts).
 * In production, set up a reverse proxy (nginx) to forward /api → backend.
 * This avoids all CORS issues.
 */

import { storage } from './storage'

const FACE_API_URL = import.meta.env.VITE_FACE_API_URL as string | undefined
const INDEX_API_KEY = import.meta.env.VITE_FACE_INDEX_API_KEY ?? ''

function apiUrl(path: string): string {
  // In dev, Vite proxies /api/* (see vite.config.ts), so a relative path works.
  // In production there's no proxy — build a full URL from the env var.
  return FACE_API_URL ? `${FACE_API_URL.replace(/\/+$/, '')}${path}` : path
}

export interface FaceSearchResult {
  photo_id: string
  album_id: string
  filename: string
  storage_path: string
  thumbnail_path: string | null
  face_id: string
  face_index: number
  bbox: { x: number; y: number; width: number; height: number }
  distance: number
  similarity: number
  url: string
  thumb_url: string | null
}

export interface FaceSearchResponse {
  query_faces_detected: number
  chosen_face_index: number
  embedding_dim: number
  results: Array<
    Omit<FaceSearchResult, 'bbox' | 'similarity'> & {
      bbox_x: number
      bbox_y: number
      bbox_width: number
      bbox_height: number
    }
  >
  processing_time: number
}

export class FaceSearchError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.status = status
  }
}

function mapResult(
  r: FaceSearchResponse['results'][number],
): FaceSearchResult {
  const view = storage.getViewUrl(r.storage_path)
  const thumb = r.thumbnail_path
    ? storage.getThumbUrl(r.thumbnail_path)
    : null
  return {
    photo_id: r.photo_id,
    album_id: r.album_id,
    filename: r.filename,
    storage_path: r.storage_path,
    thumbnail_path: r.thumbnail_path,
    face_id: r.face_id,
    face_index: r.face_index,
    bbox: { x: r.bbox_x, y: r.bbox_y, width: r.bbox_width, height: r.bbox_height },
    distance: r.distance,
    similarity: 1 - r.distance,
    url: view,
    thumb_url: thumb,
  }
}

export interface SearchByFaceOptions {
  maxDistance?: number
  topK?: number
  faceIndex?: number
  albumId?: string | null
}

/**
 * Upload a query image to the backend and return matching photos.
 */
export async function searchByFace(
  file: File,
  opts: SearchByFaceOptions = {},
): Promise<{
  results: FaceSearchResult[]
  facesDetected: number
  chosenFaceIndex: number
}> {
  const fd = new FormData()
  fd.append('file', file)
  const params = new URLSearchParams()
  if (opts.maxDistance != null) params.set('max_distance', String(opts.maxDistance))
  if (opts.topK != null) params.set('top_k', String(opts.topK))
  if (opts.faceIndex != null) params.set('face_index', String(opts.faceIndex))
  if (opts.albumId) params.set('album_id', opts.albumId)
  const qs = params.toString()
  const url = apiUrl(`/api/faces/search${qs ? '?' + qs : ''}`)

  const resp = await fetch(url, { method: 'POST', body: fd })
  if (!resp.ok) {
    let msg = 'ค้นหาไม่สำเร็จ'
    try {
      const j = await resp.json()
      msg = translateError(j.detail ?? j.message, resp.status)
    } catch {
      msg = `Search failed (${resp.status})`
    }
    throw new FaceSearchError(msg, resp.status)
  }
  const data = (await resp.json()) as FaceSearchResponse
  const results = data.results.map((r) => mapResult(r))
  return {
    results,
    facesDetected: data.query_faces_detected,
    chosenFaceIndex: data.chosen_face_index,
  }
}

/**
 * Ask backend to (re)index a specific uploaded photo.
 * Called after a successful photo upload — non-blocking; failures are swallowed.
 * Retries once on 429 (rate-limited) after a short delay.
 */
export async function indexPhoto(photoId: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const headers: Record<string, string> = {}
      if (INDEX_API_KEY) headers['X-API-Key'] = INDEX_API_KEY
      const resp = await fetch(
        apiUrl(`/api/faces/index?photo_id=${encodeURIComponent(photoId)}`),
        { method: 'POST', headers },
      )
      if (resp.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      if (!resp.ok) {
        const body = await resp.text().catch(() => '')
        console.error(`[auto-index] ${photoId} -> ${resp.status} ${body}`)
      }
      return
    } catch (err) {
      console.error('[auto-index] fetch failed', err)
      return
    }
  }
}

const INDEX_DELAY_MS = 800

/**
 * Index multiple photos sequentially with a delay between each request
 * to avoid hitting Cloud Run rate limits (429).
 */
export async function indexPhotosSequentially(
  photoIds: string[],
): Promise<void> {
  for (let i = 0; i < photoIds.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, INDEX_DELAY_MS))
    await indexPhoto(photoIds[i])
  }
}

function translateError(detail: unknown, status: number): string {
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail)
  if (status === 422 || /no face/i.test(text)) return 'ไม่พบใบหน้าในรูป — ลองใช้รูปที่เห็นใบหน้าชัดขึ้น'
  if (status === 400) return 'รูปไม่ถูกต้อง หรือยังไม่ได้เลือกใบหน้า'
  if (status === 502) return 'โหลดรูปจาก storage ไม่ได้ ลองอีกครั้ง'
  if (status === 500) return 'เซิร์ฟเวอร์ AI มีปัญหา ลองอีกครั้งในครู่'
  return text || 'ค้นหาไม่สำเร็จ'
}
