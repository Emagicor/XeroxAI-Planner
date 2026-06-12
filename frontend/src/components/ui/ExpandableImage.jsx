import { useState } from 'react'
import ImageLightbox from './ImageLightbox'
import { downloadImageFromSrc } from '@/utils/downloadImage'

function DownloadIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
      />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m4 0v-4m0 4l-5-5"
      />
    </svg>
  )
}

export default function ExpandableImage({
  src,
  alt,
  label,
  compact = false,
  thumbnail = false,
  expandable = true,
  allowDownload = false,
  downloadFilename,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div
        className={`rounded-lg border border-line bg-card/50 flex items-center justify-center text-muted text-xs ${
          compact ? 'h-28' : 'aspect-[4/3]'
        }`}
      >
        Preview unavailable
      </div>
    )
  }

  const imgClass = thumbnail
    ? 'w-full h-full object-cover rounded border border-line bg-white cursor-zoom-in'
    : compact
      ? 'w-full h-28 object-contain rounded-lg border border-line bg-white cursor-zoom-in'
      : 'w-full rounded-lg border border-line bg-white object-contain max-h-[min(520px,70vh)] cursor-zoom-in'

  const handleDownload = async (e) => {
    e.stopPropagation()
    if (!allowDownload || downloading) return
    setDownloading(true)
    try {
      await downloadImageFromSrc(src, downloadFilename || 'floor_plan.jpg')
    } catch {
      // ignore — user can retry
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`min-w-0 ${thumbnail ? 'h-full' : ''} ${className}`}>
      {label && (
        <p className="stat-label mb-2">{label}</p>
      )}
      <div className={`relative group ${thumbnail ? 'h-full' : ''}`}>
        <button
          type="button"
          className={`block w-full text-left ${thumbnail ? 'h-full' : ''} ${expandable ? '' : 'pointer-events-none'}`}
          onClick={() => expandable && setOpen(true)}
          disabled={!expandable}
        >
          <img
            src={src}
            alt={alt || label || 'Floor plan'}
            className={imgClass}
            onError={() => setError(true)}
          />
        </button>
        {!thumbnail && (expandable || allowDownload) && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {expandable && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-md border border-line/80 bg-black/70 p-1.5 text-white hover:bg-black/90"
                title="Expand"
                aria-label="Expand image"
              >
                <ExpandIcon />
              </button>
            )}
            {allowDownload && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="rounded-md border border-line/80 bg-black/70 p-1.5 text-white hover:bg-black/90 disabled:opacity-50"
                title="Download"
                aria-label="Download image"
              >
                <DownloadIcon />
              </button>
            )}
          </div>
        )}
        {expandable && compact && !thumbnail && (
          <p className="text-xs text-muted mt-1.5">Click to expand</p>
        )}
      </div>
      {open && (
        <ImageLightbox
          src={src}
          alt={alt || label}
          label={label}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
