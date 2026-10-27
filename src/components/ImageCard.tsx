import { Check, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
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
  const [failed, setFailed] = useState(false)
  // Thumbnails are the only thing the grid should download. When the server
  // hasn't generated one yet (photo.thumb falls back to the full-size URL) or
  // loading failed, show a lightweight placeholder instead of fetching the
  // multi-MB original — that was the cause of the slow, laggy album grid.
  const hasThumb = photo.thumb && photo.thumb !== photo.url && !failed
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
        {hasThumb ? (
          <img
            src={photo.thumb}
            alt={alt}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            draggable={false}
            className="pointer-events-none h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 select-none"
            style={{ WebkitTouchCallout: 'none' }}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-300">
            <ImageIcon size={26} />
          </span>
        )}
        <span className="pointer-events-none absolute inset-0 bg-slate-900/0 transition-colors duration-200 group-hover:bg-slate-900/10" />
      </button>
      <div
        className="absolute inset-0"
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => onClick(photo)}
        aria-hidden="true"
      />

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
