import { supabase, supabaseConfigured } from './supabaseClient'
import type { PhotoRow, PhotoDTO } from './types'
import { storage } from './storage'

export type { PhotoDTO }

/** Strip a photo row to the cleanup shape expected by storage.deletePhoto. */
export interface PhotoCleanup {
  id: string
  album_id: string
  storage_path: string
  thumbnail_path: string | null
}

const isMock = !supabaseConfigured || !supabase

/** In-memory mock photo store keyed by album id. */
const mockPhotoStore: Record<string, PhotoRow[]> = {}

function toDTO(row: PhotoRow): PhotoDTO {
  return {
    ...row,
    url: storage.getViewUrl(row.storage_path),
    thumb_url: row.thumbnail_path ? storage.getThumbUrl(row.thumbnail_path) : null,
  }
}

/** List all photos in an album (newest first). */
export async function listPhotos(albumId: string): Promise<PhotoDTO[]> {
  if (isMock) {
    return (mockPhotoStore[albumId] ?? []).map(toDTO)
  }

  const sb = supabase as NonNullable<typeof supabase>
  const { data, error } = await sb
    .from('photos')
    .select('*')
    .eq('album_id', albumId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => toDTO(r as PhotoRow))
}

export interface UploadProgress {
  /** 0..1 — overall batch progress. */
  fraction: number
  /** Number of files fully processed (uploaded + DB row inserted). */
  done: number
  /** Total number of files in the batch. */
  total: number
  /** Filename currently being uploaded (if any). */
  currentName: string | null
  /** Per-file status for rendering. */
  files: UploadFileState[]
}

export interface UploadFileState {
  id: string
  name: string
  size: number
  status: 'pending' | 'uploading' | 'inserting' | 'done' | 'error'
  error?: string
  previewUrl?: string
  photoId?: string
}

/** Read an image file's dimensions (best effort). */
function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ width: 0, height: 0 })
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/**
 * Upload a batch of files into an album. Calls onProgress after each file.
 * Flow per file:
 *   1. storage.uploadPhoto  → R2 (via Worker when configured) / mock
 *   2. insert metadata row   → Supabase photos table
 * If a file fails at step 1, it is skipped (no DB row created).
 */
export async function uploadPhotos(
  albumId: string,
  files: File[],
  onProgress: (p: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<{ uploaded: PhotoRow[]; failed: UploadFileState[] }> {
  const total = files.length
  const fileStates: UploadFileState[] = files.map((f, i) => ({
    id: `${Date.now()}-${i}`,
    name: f.name,
    size: f.size,
    status: 'pending',
    previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
  }))

  const uploaded: PhotoRow[] = []
  const failed: UploadFileState[] = []
  let done = 0

  const emit = (currentName: string | null) => {
    onProgress({
      fraction: total ? done / total : 0,
      done,
      total,
      currentName,
      files: [...fileStates],
    })
  }

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) break
    const file = files[i]
    const state = fileStates[i]
    state.status = 'uploading'
    emit(file.name)

    try {
      const { storagePath, thumbnailPath, fileSize, mimeType, width, height } =
        await storage.uploadPhoto(file, albumId)
      const dims =
        width && height
          ? { width, height }
          : await readImageDimensions(file)

      if (isMock) {
        const row: PhotoRow = {
          id: `mock-photo-${Date.now()}-${i}`,
          album_id: albumId,
          filename: file.name,
          storage_path: storagePath,
          thumbnail_path: thumbnailPath,
          file_size: fileSize,
          mime_type: mimeType,
          width: dims.width,
          height: dims.height,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        ;(mockPhotoStore[albumId] ??= []).unshift(row)
        uploaded.push(row)
        state.status = 'done'
        state.photoId = row.id
      } else {
        const sb = supabase as NonNullable<typeof supabase>
        state.status = 'inserting'
        emit(file.name)
        const { data, error } = await sb
          .from('photos')
          .insert({
            album_id: albumId,
            filename: file.name,
            storage_path: storagePath,
            thumbnail_path: thumbnailPath,
            file_size: fileSize,
            mime_type: mimeType,
            width: dims.width,
            height: dims.height,
          })
          .select()
          .single()
        if (error) throw error
        const row = data as PhotoRow
        uploaded.push(row)
        state.status = 'done'
        state.photoId = row.id
      }
    } catch (err) {
      state.status = 'error'
      state.error = err instanceof Error ? err.message : 'อัปโหลดล้มเหลว'
      failed.push(state)
    } finally {
      done += 1
      emit(null)
      // Revoke object URL once done to free memory.
      if (state.previewUrl) {
        setTimeout(() => URL.revokeObjectURL(state.previewUrl!), 1000)
        state.previewUrl = undefined
      }
    }
  }

  // After a successful batch, ensure the album has a cover (set to latest)
  // and index uploaded faces for AI search.
  if (uploaded.length > 0) {
    try {
      const { setCoverToLatest } = await import('./albumService')
      void setCoverToLatest(albumId)
    } catch {
      /* non-critical */
    }
    try {
      // Ask the Python AI backend to detect + index faces for each new photo.
      // Non-blocking; failures are silent (manual reindex_faces.py later).
      const { indexPhoto } = await import('./faceSearchService')
      for (const p of uploaded) {
        void indexPhoto(p.id)
      }
    } catch {
      /* non-critical */
    }
  }

  return { uploaded, failed }
}

/** Delete a single photo: R2 first, then DB row. Refreshes album cover. */
export async function deletePhoto(
  photoId: string,
  cleanup: PhotoCleanup,
): Promise<void> {
  if (isMock) {
    for (const arr of Object.values(mockPhotoStore)) {
      const idx = arr.findIndex((p) => p.id === photoId)
      if (idx >= 0) {
        arr.splice(idx, 1)
        break
      }
    }
    return
  }

  // 1. storage delete (R2 / mock)
  try {
    await storage.deletePhoto(cleanup.storage_path, cleanup.thumbnail_path)
  } catch {
    /* keep going — DB row still gets removed */
  }

  // 2. DB row
  const sb = supabase as NonNullable<typeof supabase>
  const { error } = await sb.from('photos').delete().eq('id', photoId)
  if (error) throw error

  // 3. Refresh album cover (pick next latest photo, or null when empty).
  try {
    const { setCoverToLatest } = await import('./albumService')
    await setCoverToLatest(cleanup.album_id)
  } catch {
    /* non-critical */
  }
}

/** Delete many photos. Returns count of failures. Refreshes album covers. */
export async function deletePhotos(
  photos: PhotoCleanup[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ failed: number }> {
  let failed = 0
  let done = 0
  // Track affected albums so we refresh each cover once at the end.
  const affectedAlbums = new Set<string>()
  for (const p of photos) {
    if (p.album_id) affectedAlbums.add(p.album_id)
    try {
      await deletePhoto(p.id, p)
    } catch {
      failed += 1
    }
    done += 1
    onProgress?.(done, photos.length)
  }
  // Covers are already refreshed inside deletePhoto, so nothing extra needed.
  return { failed }
}
