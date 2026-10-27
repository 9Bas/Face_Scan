/**
 * Client-side thumbnail generator.
 *
 * Generates a small JPEG downscale of an image file in the browser so the
 * grid / album covers render immediately after upload — no need to wait for
 * the AI backend to generate one later. Mirrors the backend's 600px JPEG.
 *
 * Uses createImageBitmap when available so each image is decoded only once
 * (and GPU memory is freed right after), which matters when uploading large
 * batches — the previous Image+canvas path decoded the full bitmap twice
 * (thumbnail + dimensions) and caused uploads to fail midway on big batches.
 */

export const THUMB_MAX_DIM = 600
export const THUMB_QUALITY = 0.8

export interface ThumbnailResult {
  /** Downscaled JPEG blob, or null when generation failed / not an image. */
  blob: Blob | null
  /** Decoded image dimensions (natural size). 0 when unavailable. */
  width: number
  height: number
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  )
}

/**
 * Create a client-side thumbnail. Returns the blob plus the source image
 * dimensions so callers can avoid a second decode just to read the size.
 */
export async function createThumbnail(
  file: File,
  maxDim: number = THUMB_MAX_DIM,
  quality: number = THUMB_QUALITY,
): Promise<ThumbnailResult> {
  if (!file.type.startsWith('image/')) {
    return { blob: null, width: 0, height: 0 }
  }

  // Preferred path: createImageBitmap (memory-efficient + EXIF orientation).
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      })
      const width = bmp.width
      const height = bmp.height
      try {
        const scale = maxDim / Math.max(width, height)
        const nw = scale < 1 ? Math.max(1, Math.round(width * scale)) : width
        const nh = scale < 1 ? Math.max(1, Math.round(height * scale)) : height
        const canvas = document.createElement('canvas')
        canvas.width = nw
        canvas.height = nh
        const ctx = canvas.getContext('2d')
        if (!ctx) return { blob: null, width, height }
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, nw, nh)
        ctx.drawImage(bmp, 0, 0, nw, nh)
        const blob = await encode(canvas, quality)
        return { blob, width, height }
      } finally {
        // Release decoded image memory as soon as possible.
        bmp.close()
      }
    } catch {
      /* fall through to the legacy Image path */
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      try {
        const scale = maxDim / Math.max(width, height)
        const nw = scale < 1 ? Math.max(1, Math.round(width * scale)) : width
        const nh = scale < 1 ? Math.max(1, Math.round(height * scale)) : height
        const canvas = document.createElement('canvas')
        canvas.width = nw
        canvas.height = nh
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve({ blob: null, width, height })
          return
        }
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, nw, nh)
        ctx.drawImage(img, 0, 0, nw, nh)
        encode(canvas, quality).then((blob) =>
          resolve({ blob, width, height }),
        )
      } catch {
        resolve({ blob: null, width, height })
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ blob: null, width: 0, height: 0 })
    }
    img.src = url
  })
}

/** Legacy helper: returns just the thumbnail blob. */
export async function makeThumbnailBlob(file: File): Promise<Blob | null> {
  const { blob } = await createThumbnail(file)
  return blob
}