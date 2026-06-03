import { useApiStore } from '../stores/apiStore'

export async function analyzeFloorPlan(file) {
  const endpoint = useApiStore.getState().getAnalyzeEndpoint()
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(endpoint, { method: 'POST', body: form })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const detail = err.detail
    const message =
      typeof detail === 'string'
        ? detail
        : detail?.message ||
          (Array.isArray(detail) ? detail[0]?.msg : null) ||
          err.error ||
          `Analysis failed (${res.status})`
    throw new Error(message)
  }

  return res.json()
}
