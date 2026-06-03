import { useApiStore } from '../stores/apiStore'

export async function downloadServerExport(jobId, unit, format) {
  const base = useApiStore.getState().apiBaseUrl
  const path = format === 'xlsx' ? '/export/xlsx' : '/export/csv'
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, unit }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Export failed (${res.status})`)
  }
  const blob = await res.blob()
  const ext = format === 'xlsx' ? 'xlsx' : 'csv'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `floor_plan_areas.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
