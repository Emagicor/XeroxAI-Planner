import { useApiStore } from '../stores/apiStore'
import { cloneFileForUpload } from '../utils/cloneUploadFile'

/**
 * Upload one floor plan — same path as Analyze tab.
 * Clones file bytes so repeated batch uploads cannot share a consumed stream.
 */
export async function analyzeFloorPlan(file, { isolateUpload = true } = {}) {
  const endpoint = useApiStore.getState().getAnalyzeEndpoint()
  const uploadFile = isolateUpload ? await cloneFileForUpload(file) : file

  const form = new FormData()
  form.append('file', uploadFile, uploadFile.name)

  const res = await fetch(endpoint, {
    method: 'POST',
    body: form,
    cache: 'no-store',
    headers: {
      'X-Request-Id': crypto.randomUUID(),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = err.detail
    let message =
      typeof detail === 'string'
        ? detail
        : detail?.message ||
          (Array.isArray(detail) ? detail[0]?.msg : null) ||
          err.error ||
          `Analysis failed (${res.status})`

    if (detail?.code === 'QUOTA_EXCEEDED') {
      message = detail.message || message
    } else if (/quota|429|rate limit/i.test(String(message))) {
      message =
        'Gemini API quota exceeded for this project/model. ' +
        'Wait for the daily limit to reset, enable billing in Google AI Studio, ' +
        'or change GEMINI_MODEL in backend .env (e.g. gemini-2.5-flash).'
    }

    throw new Error(message)
  }

  return res.json()
}
