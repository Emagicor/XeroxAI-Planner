import { useApiStore } from '../stores/apiStore'

/** Build data URL from inline base64 (strip whitespace). */
export function inlineAnnotatedSrc(base64) {
  if (!base64 || typeof base64 !== 'string') return null
  const clean = base64.replace(/\s/g, '')
  if (!clean) return null
  return `data:image/jpeg;base64,${clean}`
}

/** URL to fetch annotated JPEG from API (preferred — avoids huge JSON). */
export function annotatedImageApiUrl(jobId, pageNumber) {
  if (!jobId || !pageNumber) return null
  const base = useApiStore.getState().apiBaseUrl.replace(/\/$/, '')
  return `${base}/analyze/${jobId}/pages/${pageNumber}/annotated`
}

export function resolveAnnotatedSrc({ jobId, page, inlineBase64, hasAnnotated }) {
  if (hasAnnotated && jobId && page) {
    return annotatedImageApiUrl(jobId, page)
  }
  return inlineAnnotatedSrc(inlineBase64)
}
