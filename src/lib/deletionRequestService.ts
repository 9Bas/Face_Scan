import { supabase, supabaseConfigured } from './supabaseClient'
import type {
  PhotoDeletionRequestDTO,
  PhotoDeletionRequestRow,
  DeletionRequestStatus,
} from './types'

export type { PhotoDeletionRequestDTO }
export type PhotoDeletionRequestStatus = DeletionRequestStatus
import { storage } from './storage'
import { deletePhoto, type PhotoCleanup } from './photoService'

const isMock = !supabaseConfigured || !supabase

const mockRequests: PhotoDeletionRequestRow[] = []

function toDTO(row: PhotoDeletionRequestRow): PhotoDeletionRequestDTO {
  return row
}

export async function createDeletionRequest(
  photoId: string,
  requesterId: string,
  requesterEmail: string | null,
  reason?: string,
): Promise<PhotoDeletionRequestDTO> {
  if (isMock) {
    const req: PhotoDeletionRequestRow = {
      id: `mock-req-${Date.now()}`,
      photo_id: photoId,
      requester_id: requesterId,
      requester_email: requesterEmail,
      reason: reason ?? null,
      status: 'pending',
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    mockRequests.unshift(req)
    return toDTO(req)
  }

  const sb = supabase as NonNullable<typeof supabase>
  const { data, error } = await sb
    .from('photo_deletion_requests')
    .insert({
      photo_id: photoId,
      requester_id: requesterId,
      requester_email: requesterEmail,
      reason: reason ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('duplicate') || msg.includes('unique')) {
      throw new Error('คุณได้ส่งคำขอลบรูปนี้ไปแล้ว')
    }
    if (msg.includes('rls') || msg.includes('policy')) {
      throw new Error('ไม่มีสิทธิ์ส่งคำขอลบ กรุณาเข้าสู่ระบบ')
    }
    if (msg.includes('foreign key')) {
      throw new Error('ไม่พบรูปภาพนี้ในระบบ')
    }
    throw new Error(error.message)
  }
  return toDTO(data as PhotoDeletionRequestRow)
}

export async function listDeletionRequests(
  status?: PhotoDeletionRequestStatus,
): Promise<PhotoDeletionRequestDTO[]> {
  if (isMock) {
    const filtered = status
      ? mockRequests.filter((r) => r.status === status)
      : mockRequests
    return filtered.map(toDTO)
  }

  const sb = supabase as NonNullable<typeof supabase>
  let query = sb.from('photo_deletion_requests').select('*').order('created_at', { ascending: false })
  if (status) {
    query = query.eq('status', status)
  }
  const { data, error } = await query
  if (error) throw error

  const requests = (data ?? []) as PhotoDeletionRequestRow[]
  const photoIds = [...new Set(requests.map((r) => r.photo_id))]
  const photosMap = new Map<string, any>()

  if (photoIds.length) {
    const { data: photoRows, error: photoErr } = await sb
    .from('photos')
    .select('id, album_id, filename, storage_path, thumbnail_path, width, height')
    .in('id', photoIds)
  if (!photoErr) {
    for (const pr of photoRows ?? []) {
      photosMap.set((pr as any).id, pr)
    }
  }
  // Try to get album ids separately if missing
  const missingAlbum = [...photoIds].filter((pid) => {
    const p = photosMap.get(pid)
    return p && (p.album_id == null)
  })
  if (missingAlbum.length) {
    const { data: photoRows2 } = await sb
      .from('photos')
      .select('id, album_id')
      .in('id', missingAlbum)
    for (const pr of photoRows2 ?? []) {
      const existing = photosMap.get((pr as any).id) || {}
      photosMap.set((pr as any).id, { ...existing, ...pr })
    }
  }
  }

  return requests.map((r) => {
    const pr = photosMap.get(r.photo_id)
    if (!pr) {
      return { ...r, album_id: null, photo: undefined } as PhotoDeletionRequestDTO
    }
    const p = pr as any
    const albumId = p.albums?.id ?? p.album_id ?? null
    let viewUrl: string | undefined
    let thumbUrl: string | undefined
    try {
      if (p.storage_path) {
        const u = storage.getViewUrl(p.storage_path)
        if (typeof u === 'string') viewUrl = u
      }
    } catch {
      viewUrl = undefined
    }
    try {
      if (p.thumbnail_path) {
        const u = storage.getThumbUrl(p.thumbnail_path)
        if (typeof u === 'string') thumbUrl = u
      }
    } catch {
      thumbUrl = undefined
    }
    if (!thumbUrl) thumbUrl = viewUrl
    const photoObj: any = {
      id: p.id,
      album_id: albumId,
    }
    if (p.filename !== null && p.filename !== undefined) photoObj.filename = p.filename
    if (p.storage_path !== null && p.storage_path !== undefined) photoObj.storage_path = p.storage_path
    if (p.thumbnail_path !== null && p.thumbnail_path !== undefined) photoObj.thumbnail_path = p.thumbnail_path
    if (p.width !== null && p.width !== undefined) photoObj.width = p.width
    if (p.height !== null && p.height !== undefined) photoObj.height = p.height
    if (typeof viewUrl === 'string') photoObj.url = viewUrl
    if (typeof thumbUrl === 'string') photoObj.thumb_url = thumbUrl
    return {
      ...r,
      album_id: albumId,
      photo: photoObj,
    } as PhotoDeletionRequestDTO
  })
}

export async function updateDeletionRequestStatus(
  requestId: string,
  status: PhotoDeletionRequestStatus,
  reviewerId: string,
  cleanup?: PhotoCleanup,
): Promise<void> {
  if (isMock) {
    const req = mockRequests.find((r) => r.id === requestId)
    if (req) {
      req.status = status
      req.reviewed_by = reviewerId
      req.reviewed_at = new Date().toISOString()
      req.updated_at = new Date().toISOString()
    }
    if (status === 'approved' && cleanup) {
      // simulate deletion
    }
    return
  }

  const sb = supabase as NonNullable<typeof supabase>
  const { error } = await sb
    .from('photo_deletion_requests')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
  if (error) throw error

  if (status === 'approved' && cleanup) {
    await deletePhoto(cleanup.id, cleanup)
  }
}
