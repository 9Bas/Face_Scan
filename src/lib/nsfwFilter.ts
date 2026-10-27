import * as nsfwjs from 'nsfwjs'
import '@tensorflow/tfjs'

let model: nsfwjs.NSFWJS | null = null
let loading: Promise<nsfwjs.NSFWJS> | null = null

/**
 * โหลดโมเดล NSFWJS แบบ lazy — โหลดครั้งเดียว
 */
export async function loadNsfwModel(): Promise<nsfwjs.NSFWJS> {
  if (model) return model
  if (loading) return loading

  loading = nsfwjs.load('MobileNetV2').then((m) => {
    model = m
    return m
  })

  return loading
}

export interface NsfwCheckResult {
  blocked: boolean
  reason?: string
  scores?: Record<string, number>
}

/**
 * คลาสจาก nsfwjs ที่ถือว่าไม่เหมาะสม — Drawing/Neutral = ผ่าน
 */
const BLOCKED_CLASSES = ['Porn', 'Hentai', 'Sexy'] as const

/**
 * ตรวจรูป NSFW — เฉพาะ public album ควรเรียกใช้งาน
 * บล็อค Porn/Hentai/Sexy เมื่อค่าความมั่นใจ >= threshold
 */
export async function checkImageNsfw(file: File, threshold = 0.45): Promise<NsfwCheckResult> {
  const m = await loadNsfwModel()
  const img = new Image()
  const url = URL.createObjectURL(file)

  try {
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })

    const predictions = await m.classify(loaded, 5)

    const scores: Record<string, number> = {}
    for (const p of predictions) {
      scores[p.className] = p.probability
    }

    if (import.meta.env.DEV) {
      console.info('[nsfw]', file.name, scores)
    }

    const hit = BLOCKED_CLASSES.find((c) => (scores[c] ?? 0) >= threshold)

    if (hit) {
      return {
        blocked: true,
        reason: 'รูปภาพนี้ไม่ผ่านเกณฑ์ (พบเนื้อหาไม่เหมาะสมสำหรับอัลบั้มสาธารณะ)',
        scores,
      }
    }

    return { blocked: false, scores }
  } catch {
    return { blocked: false }
  } finally {
    URL.revokeObjectURL(url)
  }
}
