import { supabase, supabaseConfigured } from './supabaseClient'
import type { AlbumRow, AlbumCategory, PhotoRow } from './types'
import { albums as mockAlbums } from '../data'

export interface AlbumInput {
  name: string
  description?: string | null
  event_date?: string | null
  location?: string | null
  category?: AlbumCategory | null
  cover_photo_id?: string | null
}

export interface AlbumWithMeta extends AlbumRow {
  photo_count: number
  cover_url: string | null
}

const isMockUser = !supabaseConfigured || !supabase

/** In-memory store for mock mode (preserved across calls within one session). */
const mockStore: Record<string, typeof mockAlbums[number][]> = {
  mock: [...mockAlbums.map((a) => ({ ...a }))],
}

function mockOwnerId(): string {
  return 'mock'
}

/** Fetch ALL albums (every photographer) with photo count + cover URL. */
export async function listMyAlbums(_userId?: string): Promise<AlbumWithMeta[]> {
  if (isMockUser) {
    return mockStore[mockOwnerId()].map((a) => ({
      id: a.id,
      photographer_id: mockOwnerId(),
      name: a.name,
      description: a.description ?? null,
      event_date: null,
      location: a.location ?? null,
      category: a.category ?? null,
      cover_photo_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      photo_count: a.photos.length,
      cover_url: a.cover,
    }))
  }

  const sb = supabase as NonNullable<typeof supabase>

  // One query on the SQL view: albums + photo_count (no per-album count).
  const { data, error } = await sb
    .from('albums_with_counts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error

  const aRows = (data ?? []) as (AlbumRow & { photo_count: number })[]

  // Resolve all explicit cover urls in one batched query (no N+1).
  const coverIds = aRows
    .map((a) => a.cover_photo_id)
    .filter(Boolean) as string[]
  const coverRows = new Map<
    string,
    Pick<PhotoRow, 'storage_path' | 'thumbnail_path'>
  >()
  if (coverIds.length) {
    const { data: covers } = await sb
      .from('photos')
      .select('id,storage_path,thumbnail_path')
      .in('id', coverIds)
    for (const c of (covers ?? []) as Array<
      Pick<PhotoRow, 'id' | 'storage_path' | 'thumbnail_path'>
    >) {
      coverRows.set(c.id, c)
    }
  }

  return aRows.map((a) => {
    const cover = a.cover_photo_id ? coverRows.get(a.cover_photo_id) : null
    return {
      ...a,
      photo_count: a.photo_count,
      cover_url: cover ? cover.thumbnail_path ?? cover.storage_path : null,
    }
  })
}

/** Create a new album owned by the given user. */
export async function createAlbum(
  userId: string,
  input: AlbumInput,
): Promise<AlbumRow> {
  if (isMockUser) {
    const id = `mock-${Date.now()}`
    const now = new Date().toISOString()
    const row: AlbumRow = {
      id,
      photographer_id: mockOwnerId(),
      name: input.name,
      description: input.description ?? null,
      event_date: input.event_date ?? null,
      location: input.location ?? null,
      category: input.category ?? null,
      cover_photo_id: null,
      created_at: now,
      updated_at: now,
    }
    mockStore[mockOwnerId()].unshift({ ...row, photos: [] } as unknown as typeof mockAlbums[number])
    return row
  }

  const sb = supabase as NonNullable<typeof supabase>
  const { data, error } = await sb
    .from('albums')
    .insert({
      photographer_id: userId,
      name: input.name,
      description: input.description ?? null,
      event_date: input.event_date ?? null,
      location: input.location ?? null,
      category: input.category ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as AlbumRow
}

/** Update an existing album (RLS enforces ownership). */
export async function updateAlbum(
  albumId: string,
  input: Partial<AlbumInput>,
): Promise<AlbumRow> {
  if (isMockUser) {
    const list = mockStore[mockOwnerId()]
    const idx = list.findIndex((a) => a.id === albumId)
    if (idx < 0) throw new Error('ไม่พบอัลบั้ม')
    const updated = {
      ...list[idx],
      ...input,
      updated_at: new Date().toISOString(),
    } as typeof list[number]
    list[idx] = updated
    return updated as unknown as AlbumRow
  }

  const sb = supabase as NonNullable<typeof supabase>
  const { data, error } = await sb
    .from('albums')
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.event_date !== undefined && { event_date: input.event_date }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.cover_photo_id !== undefined && { cover_photo_id: input.cover_photo_id }),
    })
    .eq('id', albumId)
    .select()
    .single()
  if (error) throw error
  return data as AlbumRow
}

/** Delete an album. Caller is responsible for cleaning up R2 files first. */
export async function deleteAlbum(
  albumId: string,
  /** Callback to delete each photo's storage object before row removal. */
  cleanupPhotos?: (photo: Pick<PhotoRow, 'id' | 'storage_path' | 'thumbnail_path'>) => Promise<void>,
): Promise<void> {
  if (isMockUser) {
    const list = mockStore[mockOwnerId()]
    mockStore[mockOwnerId()] = list.filter((a) => a.id !== albumId)
    return
  }

  const sb = supabase as NonNullable<typeof supabase>
  // Fetch the album's photos so caller can delete files from R2.
  const { data: photos } = await sb
    .from('photos')
    .select('id,storage_path,thumbnail_path')
    .eq('album_id', albumId)
  if (cleanupPhotos && photos) {
    for (const p of photos as Pick<PhotoRow, 'id' | 'storage_path' | 'thumbnail_path'>[]) {
      try {
        await cleanupPhotos(p)
      } catch {
        /* keep going — DB row still gets removed */
      }
    }
  }
  // Cascade FK will drop photos rows automatically; album delete last.
  const { error } = await sb.from('albums').delete().eq('id', albumId)
  if (error) throw error
}

/** Get a single album by id (owner only — RLS guards). */
export async function getAlbum(
  albumId: string,
): Promise<AlbumWithMeta | null> {
  if (isMockUser) {
    const a = mockStore[mockOwnerId()].find((x) => x.id === albumId)
    if (!a) return null
    return {
      id: a.id,
      photographer_id: mockOwnerId(),
      name: a.name,
      description: a.description ?? null,
      event_date: null,
      location: a.location ?? null,
      category: a.category ?? null,
      cover_photo_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      photo_count: a.photos.length,
      cover_url: a.cover,
    }
  }

  const sb = supabase as NonNullable<typeof supabase>
  const { data, error } = await sb
    .from('albums')
    .select('*')
    .eq('id', albumId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const a = data as AlbumRow
  const countResp = await sb
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('album_id', a.id)

  let coverUrl: string | null = null
  if (a.cover_photo_id) {
    const { data: cover } = await sb
      .from('photos')
      .select('storage_path,thumbnail_path')
      .eq('id', a.cover_photo_id)
      .maybeSingle()
    const c = cover as Pick<PhotoRow, 'storage_path' | 'thumbnail_path'> | null
    if (c) coverUrl = c.thumbnail_path ?? c.storage_path
  }
  return { ...a, photo_count: countResp.count ?? 0, cover_url: coverUrl }
}

/**
 * Set an album's cover to its most recently uploaded photo.
 * When the album has no photos left, clears cover_photo_id to null.
 */
export async function setCoverToLatest(albumId: string): Promise<void> {
  if (isMockUser) return
  const sb = supabase as NonNullable<typeof supabase>
  const { data } = await sb
    .from('photos')
    .select('id')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const latest = data as { id: string } | null
  if (!latest) {
    // No photos left — clear the cover so it doesn't point at a deleted photo.
    await sb.from('albums').update({ cover_photo_id: null }).eq('id', albumId)
    return
  }
  await sb.from('albums').update({ cover_photo_id: latest.id }).eq('id', albumId)
}