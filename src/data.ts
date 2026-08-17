export type Category =
  | 'sports'
  | 'academic'
  | 'activities'
  | 'culture'

export interface CategoryInfo {
  id: Category | 'all'
  label: string
}

export const categories: CategoryInfo[] = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'sports', label: 'กีฬา' },
  { id: 'academic', label: 'วิชาการ' },
  { id: 'activities', label: 'กิจกรรม' },
  { id: 'culture', label: 'วัฒนธรรม' },
]

export interface Photo {
  id: string
  url: string
  thumb: string
  title: string
  width: number
  height: number
}

export interface Album {
  id: string
  name: string
  description: string
  date: string
  location: string
  category: Category
  cover: string
  photos: Photo[]
}

const img = (seed: string, w = 800, h = 600): string =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`

const buildPhotos = (
  prefix: string,
  count: number,
  w = 800,
  h = 600,
): Photo[] =>
  Array.from({ length: count }, (_, i): Photo => {
    const id = `${prefix}-${i + 1}`
    return {
      id,
      url: img(`${prefix}-full-${i + 1}`, w, h),
      thumb: img(`${prefix}-thumb-${i + 1}`, 600, 450),
      title: `${prefix} #${i + 1}`,
      width: w,
      height: h,
    }
  })

export const albums: Album[] = [
  {
    id: 'psru-freshy-2025',
    name: 'PSRU Freshy 2025',
    description:
      'Annual freshman orientation highlights — welcome activities and performances on the Freshy stage.',
    date: 'Jun 12, 2025',
    location: 'PSRU Main Auditorium',
    category: 'activities',
    cover: img('psru-freshy-2025-cover', 1000, 700),
    photos: buildPhotos('psru-freshy', 12),
  },
  {
    id: 'sport-day-2025',
    name: 'Sport Day 2025',
    description:
      'Action shots from the annual university sports festival across all faculties.',
    date: 'Jan 18, 2025',
    location: 'PSRU Stadium',
    category: 'sports',
    cover: img('sport-day-2025-cover', 1000, 700),
    photos: buildPhotos('sportday', 18),
  },
  {
    id: 'graduation-2024',
    name: 'Graduation Ceremony 2024',
    description:
      'Momentous graduation day captured from the parade to diploma conferral.',
    date: 'Oct 24, 2024',
    location: 'Convention Hall',
    category: 'academic',
    cover: img('graduation-2024-cover', 1000, 700),
    photos: buildPhotos('graduation', 15),
  },
  {
    id: 'agritech-expo',
    name: 'Agritech Expo',
    description:
      'Highlights from the Agricultural Technology exhibition and innovation booths.',
    date: 'Mar 6, 2025',
    location: 'PSRU Agro Park',
    category: 'academic',
    cover: img('agritech-expo-cover', 1000, 700),
    photos: buildPhotos('agritech', 9),
  },
  {
    id: 'loy-krathong-2024',
    name: 'Loy Krathong 2024',
    description:
      'A glowing evening of traditional dress, krathong floating and cultural performances.',
    date: 'Nov 15, 2024',
    location: 'PSRU Pond',
    category: 'culture',
    cover: img('loy-krathong-2024-cover', 1000, 700),
    photos: buildPhotos('loykrathong', 11),
  },
  {
    id: 'songkran-2025',
    name: 'Songkran Festival 2025',
    description:
      'Water blessings, traditional rituals and vibrant student parades celebrating Thai New Year.',
    date: 'Apr 12, 2025',
    location: 'PSRU Plaza',
    category: 'culture',
    cover: img('songkran-2025-cover', 1000, 700),
    photos: buildPhotos('songkran', 10),
  },
  {
    id: 'science-fair-2025',
    name: 'Science & Innovation Fair',
    description:
      'Poster sessions, robotics demos and research showcases from across faculties.',
    date: 'Feb 20, 2025',
    location: 'PSRU Science Complex',
    category: 'academic',
    cover: img('science-fair-2025-cover', 1000, 700),
    photos: buildPhotos('sciencefair', 8),
  },
  {
    id: 'volunteer-camp-2025',
    name: 'Volunteer Camp 2025',
    description:
      'Community service camp — students teaching, building and giving back in rural villages.',
    date: 'May 3, 2025',
    location: 'Phrae Province',
    category: 'activities',
    cover: img('volunteer-camp-2025-cover', 1000, 700),
    photos: buildPhotos('volunteer', 7),
  },
]

export const getAlbumById = (albumId: string | undefined): Album | undefined =>
  albums.find((a) => a.id === albumId)

/** Every photo across every album — the "gallery-wide" search pool. */
export const allPhotos: Photo[] = albums.flatMap((a) => a.photos)

/**
 * Mocked "AI" face match over a given photo pool.
 * Returns a shuffled subset so results feel varied; falls back to the
 * full pool when it's small. Replace with a real embedding/vector search later.
 */
export function mockFaceSearch(pool: Photo[]): Photo[] {
  if (pool.length <= 6) return [...pool]
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const count = Math.max(6, Math.round(pool.length * (0.55 + Math.random() * 0.3)))
  return shuffled.slice(0, Math.min(count, pool.length))
}

// Mock search results — returned by the mocked "AI" search action.
export const mockSearchResults: Photo[] = [
  ...buildPhotos('result', 15, 1000, 750),
]

/** Derive the real stored filename from a photo's view URL when possible. */
function photoFilename(photo: Photo): string {
  try {
    const u = new URL(photo.url, window.location.origin)
    const rawPath = u.searchParams.get('path') || u.pathname
    const base = decodeURIComponent(rawPath.split('/').pop() || '')
    if (/\.\w{2,5}$/.test(base)) return base
  } catch {
    /* fall through */
  }
  const fallback = (photo.title || 'photo').replace(/\s+/g, '-')
  return /\.\w{2,5}$/.test(fallback) ? fallback : `${fallback}.jpg`
}

/** Trigger a browser download for a photo (forces attachment via worker ?download= param). */
export async function downloadPhoto(photo: Photo): Promise<void> {
  const filename = photoFilename(photo)
  // The R2 worker honors ?download= to force Content-Disposition: attachment.
  // Append a cache-buster so stale inline responses cached by the browser/CDN
  // (from the <img> / earlier requests) are never replayed for the download.
  const sep = photo.url.includes('?') ? '&' : '?'
  const downloadUrl = `${photo.url}${sep}download=${encodeURIComponent(filename)}&ts=${Date.now()}`
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}