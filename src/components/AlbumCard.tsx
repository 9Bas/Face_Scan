import { Link } from 'react-router-dom'
import { Images, MapPin } from 'lucide-react'
import type { PublicAlbum } from '../lib/galleryService'
import { photoViewUrl } from '../lib/galleryService'

export default function AlbumCard({ album }: { album: PublicAlbum }) {
  const count = album.photo_count
  const coverUrl = album.cover_url ? photoViewUrl(album.cover_url) : null
  return (
    <Link
      to={`/gallery/${album.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={album.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Images size={36} />
          </div>
        )}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          <Images size={13} className="text-brand-600" />
          {count} photos
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-bold text-slate-900">{album.name}</h3>
        {album.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">
            {album.description}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-slate-400">
          {album.event_date && <span>{album.event_date}</span>}
          {album.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {album.location}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}