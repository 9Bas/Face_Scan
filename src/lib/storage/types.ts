export interface UploadResult {
  storagePath: string
  thumbnailPath: string | null
  fileSize: number
  mimeType: string
  width?: number
  height?: number
}

/**
 * Storage abstraction — keeps Gallery/Album/Login code unchanged when we
 * switch between the mock dev mode (no account) and R2 via Worker (real).
 * Step 3 can add another impl (e.g. with thumbnail pre-generation) without
 * touching UI.
 */
export interface IStorage {
  kind: 'mock' | 'r2'
  getViewUrl(storagePath: string): string
  getThumbUrl(thumbnailPath: string | null): string | null
  uploadPhoto(file: File, albumId: string): Promise<UploadResult>
  deletePhoto(storagePath: string, thumbnailPath: string | null): Promise<void>
}