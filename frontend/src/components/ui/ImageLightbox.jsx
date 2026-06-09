import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ImageLightbox({ src, alt, label, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!src) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label || alt || 'Expanded image'}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-lg border border-white/20 bg-black/50 px-3 py-1.5 text-sm text-white hover:bg-black/70"
      >
        Close
      </button>
      <img
        src={src}
        alt={alt || label || 'Expanded preview'}
        className="max-w-full max-h-[90vh] rounded-lg border border-white/15 object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  )
}
