import { useApiStore } from '../stores/apiStore'

/** Guess image MIME from base64 magic bytes. */
export function detectBase64ImageMime(base64) {
  if (!base64 || typeof base64 !== 'string') return 'image/jpeg'
  const clean = base64.replace(/\s/g, '')
  if (clean.startsWith('iVBOR')) return 'image/png'
  if (clean.startsWith('/9j/')) return 'image/jpeg'
  if (clean.startsWith('R0lGOD')) return 'image/gif'
  if (clean.startsWith('UklGR')) return 'image/webp'
  return 'image/png'
}

/** Build data URL from inline base64 (strip whitespace). */
export function inlineImageSrc(base64, fallbackMime = 'image/png') {
  if (!base64 || typeof base64 !== 'string') return null
  if (base64.startsWith('data:')) return base64
  const clean = base64.replace(/\s/g, '')
  if (!clean) return null
  const mime = detectBase64ImageMime(clean) || fallbackMime
  return `data:${mime};base64,${clean}`
}

/** Build data URL from inline base64 (strip whitespace). */
export function inlineAnnotatedSrc(base64) {
  return inlineImageSrc(base64, 'image/jpeg')
}

/** URL to fetch annotated JPEG from API (preferred — avoids huge JSON). */
export function annotatedImageApiUrl(jobId, pageNumber) {
  if (!jobId || !pageNumber) return null
  const base = useApiStore.getState().apiBaseUrl.replace(/\/$/, '')
  return `${base}/analyze/${jobId}/pages/${pageNumber}/annotated`
}

export function resolveAnnotatedSrc({ jobId, page, inlineBase64, hasAnnotated }) {
  const inline = inlineAnnotatedSrc(inlineBase64)
  if (inline) return inline
  if (hasAnnotated && jobId && page) {
    return annotatedImageApiUrl(jobId, page)
  }
  return null
}
