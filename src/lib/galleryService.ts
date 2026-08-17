import { supabase, supabaseConfigured } from './supabaseClient'
import type { AlbumRow, PhotoRow, AlbumCategory } from './types'
import { albums as mockAlbums } from '../data'
import { storage } from './storage'

export interface PublicAlbum extends AlbumRow {
  photo_count: number
  cover_url: string | null
  category_label?: string | null
}

export interface PublicPhoto {
  id: string
  album_id: string
  filename: string
  storage_path: string
  thumbnail_path: string | null
  url: string
  thumb_url: string | null
  width: number | null
  height: number | null
}

const isMock = !supabaseConfigured || !supabase

const categoryLabels: Record<string, string> = {
  sports: 'กีฬา',
  academic: 'วิชาการ',
  activities: 'กิจกรรม',
  culture: 'วัฒนธรรม',
}

function toPublicAlbum(
  a: AlbumRow,
  photoCount: number,
  coverUrl: string | null,
): PublicAlbum {
  return {
    ...a,
    photo_count: photoCount,
    cover_url: coverUrl,
    category_label: a.category ? categoryLabels[a.category] : null,
  }
}

function toPublicPhoto(row: PhotoRow): PublicPhoto {
  return {
    id: row.id,
    album_id: row.album_id,
    filename: row.filename,
    storage_path: row.storage_path,
    thumbnail_path: row.thumbnail_path,
    url: storage.getViewUrl(row.storage_path),
    thumb_url: row.thumbnail_path
      ? storage.getThumbUrl(row.thumbnail_path)
      : null,
    width: row.width,
    height: row.height,
  }
}

/** List all public albums (any visitor, no auth required). */
export async function listPublicAlbums(): Promise<PublicAlbum[]> {
  if (isMock) {
    return mockAlbums.map((a) =>
      toPublicAlbum(
        {
          id: a.id,
          photographer_id: 'mock',
          name: a.name,
          description: a.description ?? null,
          event_date: null,
          location: a.location ?? null,
          category: a.category ?? null,
          cover_photo_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        a.photos.length,
        a.cover,
      ),
    )
  }

  const sb = supabase as NonNullable<typeof supabase>

  // One query pulls albums + photo_count from the prebuilt SQL view,
  // so we no longer download every photo row just to count them.
  const [albResp, phoResp] = await Promise.all([
    sb
      .from('albums_with_counts')
      .select('*')
      .order('created_at', { ascending: false }),
    // One query with only the columns needed to resolve cover images.
    sb
      .from('photos')
      .select('id,album_id,storage_path,thumbnail_path')
      .order('created_at', { ascending: false }),
  ])
  if (albResp.error) throw albResp.error
  if (phoResp.error) throw phoResp.error

  const aRows = (albResp.data ?? []) as (AlbumRow & { photo_count: number })[]
  const pRows = (phoResp.data ?? []) as Pick<
    PhotoRow,
    'id' | 'album_id' | 'storage_path' | 'thumbnail_path'
  >[]

  // Latest photo per album (fallback cover when no explicit cover_photo_id).
  const latestByAlbum = new Map<string, typeof pRows[number]>()
  for (const p of pRows) {
    if (!latestByAlbum.has(p.album_id)) latestByAlbum.set(p.album_id, p)
  }

  // Resolve explicit cover urls in a single batched query.
  const coverPhotoIds = aRows
    .map((a) => a.cover_photo_id)
    .filter(Boolean) as string[]
  const coverRows = new Map<string, typeof pRows[number]>()
  if (coverPhotoIds.length) {
    const { data } = await sb
      .from('photos')
      .select('id,storage_path,thumbnail_path')
      .in('id', coverPhotoIds)
    for (const r of (data ?? []) as typeof pRows) {
      coverRows.set(r.id, r)
    }
  }

  return aRows.map((a) => {
    const coverRow = a.cover_photo_id
      ? coverRows.get(a.cover_photo_id)
      : latestByAlbum.get(a.id)
    const coverUrl = coverRow
      ? coverRow.thumbnail_path ?? coverRow.storage_path
      : null
    return toPublicAlbum(a, a.photo_count, coverUrl)
  })
}

/** Get a single public album by id. */
export async function getPublicAlbum(albumId: string): Promise<PublicAlbum | null> {
  if (isMock) {
    const a = mockAlbums.find((x) => x.id === albumId)
    if (!a) return null
    return toPublicAlbum(
      {
        id: a.id,
        photographer_id: 'mock',
        name: a.name,
        description: a.description ?? null,
        event_date: null,
        location: a.location ?? null,
        category: a.category ?? null,
        cover_photo_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      a.photos.length,
      a.cover,
    )
  }

  const sb = supabase as NonNullable<typeof supabase>
  // parallel: album + count + latest photo (fallback cover)
  const [albResp, countResp, latestResp] = await Promise.all([
    sb.from('albums').select('*').eq('id', albumId).maybeSingle(),
    sb
      .from('photos')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', albumId),
    sb
      .from('photos')
      .select('id,storage_path,thumbnail_path')
      .eq('album_id', albumId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (albResp.error) throw albResp.error
  if (!albResp.data) return null
  const a = albResp.data as AlbumRow

  let coverUrl: string | null = null
  if (a.cover_photo_id) {
    const { data } = await sb
      .from('photos')
      .select('storage_path,thumbnail_path')
      .eq('id', a.cover_photo_id)
      .maybeSingle()
    const c = data as Pick<PhotoRow, 'storage_path' | 'thumbnail_path'> | null
    if (c) coverUrl = c.thumbnail_path ?? c.storage_path
  } else {
    const latest = latestResp.data as
      | Pick<PhotoRow, 'storage_path' | 'thumbnail_path'>
      | null
    if (latest) coverUrl = latest.thumbnail_path ?? latest.storage_path
  }
  return toPublicAlbum(a, countResp.count ?? 0, coverUrl)
}

/** List all public photos in a single album. */
export async function listAlbumPhotos(albumId: string): Promise<PublicPhoto[]> {
  if (isMock) {
    const a = mockAlbums.find((x) => x.id === albumId) ?? mockAlbums[0]
    return a.photos.map((p) => ({
      id: p.id,
      album_id: a.id,
      filename: p.title,
      storage_path: p.url,
      thumbnail_path: p.thumb,
      url: p.url,
      thumb_url: p.thumb,
      width: p.width,
      height: p.height,
    }))
  }

  const sb = supabase as NonNullable<typeof supabase>
  const { data, error } = await sb
    .from('photos')
    .select('*')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => toPublicPhoto(r as PhotoRow))
}

/** Helper to turn a storage path into a viewable URL. */
export function photoViewUrl(storagePath: string): string {
  return storage.getViewUrl(storagePath)
}

export type { AlbumCategory }