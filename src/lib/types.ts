/**
 * Database row types — mirror of `supabase/migrations/0001_init.sql`.
 * Keep these in sync with the SQL migration when columns change.
 */
export type Role = 'photographer' | 'admin'

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  role: Role
  created_at: string
}

export type AlbumCategory = 'sports' | 'academic' | 'activities' | 'culture'

export interface AlbumRow {
  id: string
  photographer_id: string
  name: string
  description: string | null
  event_date: string | null
  location: string | null
  category: AlbumCategory | null
  cover_photo_id: string | null
  created_at: string
  updated_at: string
}

export interface PhotoRow {
  id: string
  album_id: string
  filename: string
  storage_path: string
  thumbnail_path: string | null
  file_size: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  created_at: string
  updated_at: string
}

/** Shape consumed by the UI (cached public read models). */
export interface AlbumDTO extends AlbumRow {
  photo_count: number
  cover_url: string | null
}

export interface PhotoDTO extends PhotoRow {
  url: string
  thumb_url: string | null
}