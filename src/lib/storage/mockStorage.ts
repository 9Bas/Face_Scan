import type { IStorage, UploadResult } from './types'

/**
 * Mock storage — keeps the app working before a Cloudflare R2/Worker
 * account exists. Uses picsum.photos seeds so generated URLs are stable.
 * Swapped out automatically once VITE_WORKER_URL is set.
 */
export const mockStorage: IStorage = {
  kind: 'mock',
  getViewUrl(storagePath: string): string {
    const seed = encodeURIComponent(storagePath)
    return `https://picsum.photos/seed/${seed}/1000/750`
  },
  getThumbUrl(thumbnailPath: string | null): string | null {
    if (!thumbnailPath) return null
    const seed = encodeURIComponent(thumbnailPath)
    return `https://picsum.photos/seed/${seed}/600/450`
  },
  async uploadPhoto(
    _file: File,
    albumId: string,
  ): Promise<UploadResult> {
    // Fake a deterministic path that matches R2 layout for later migration.
    const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    return {
      storagePath: `albums/${albumId}/original/${name}.jpg`,
      thumbnailPath: null,
      fileSize: _file.size,
      mimeType: _file.type || 'image/jpeg',
    }
  },
  async deletePhoto(): Promise<void> {
    /* no-op in mock */
  },
}