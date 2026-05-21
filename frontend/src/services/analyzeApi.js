import { useApiStore } from '../stores/apiStore'

export async function analyzeFloorPlan(file) {
  const endpoint = useApiStore.getState().getAnalyzeEndpoint()
  const form = new FormData()
  form.append('file', file)

  const res = await fetch(endpoint, { method: 'POST', body: form })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Analysis failed')
  }

  return res.json()
}
