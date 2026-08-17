import { Check } from 'lucide-react'
import type { Photo } from '../data'

interface ImageCardProps {
  photo: Photo
  onClick: (photo: Photo) => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (photo: Photo) => void
}

export default function ImageCard({
  photo,
  onClick,
  selectable = false,
  selected = false,
  onToggleSelect,
}: ImageCardProps) {
  // Always fall back to the full URL when thumb is missing/empty.
  const src = photo.thumb || photo.url
  const alt = photo.title || 'photo'

  return (
    <div
      className="group relative block w-full overflow-hidden rounded-xl bg-slate-100"
      style={{ aspectRatio: '4 / 3' }}
    >
      <button
        type="button"
        onClick={() => onClick(photo)}
        className="absolute inset-0 h-full w-full cursor-zoom-in"
        aria-label={`Open ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          onError={(e) => {
            // If thumb fails, swap to full URL as a last resort.
            const el = e.currentTarget
            if (el.src !== photo.url) el.src = photo.url
          }}
        />
        <span className="pointer-events-none absolute inset-0 bg-slate-900/0 transition-colors duration-200 group-hover:bg-slate-900/10" />
      </button>

      {selectable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect?.(photo)
          }}
          aria-label={selected ? 'Deselect' : 'Select'}
          className={[
            'absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-md transition-all',
            selected
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-white bg-white/80 text-transparent backdrop-blur hover:bg-white',
          ].join(' ')}
        >
          <Check size={15} strokeWidth={3} />
        </button>
      )}

      {selected && (
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-brand-500" />
      )}
    </div>
  )
}