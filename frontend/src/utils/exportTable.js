import { grandTotalSqft, rowsToExportLines } from './analysis'
import { convertAreaFromSqft, unitLabel } from './units'

export function downloadTableCSV(rows, unit) {
  const csv = rowsToExportLines(rows, unit, convertAreaFromSqft, unitLabel)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'floor_plan_areas.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyTableToClipboard(rows, unit) {
  const text = rowsToExportLines(rows, unit, convertAreaFromSqft, unitLabel)
  await navigator.clipboard.writeText(text)
}

export function formatArea(sqft, unit) {
  if (sqft == null) return '—'
  return convertAreaFromSqft(sqft, unit)
}

export { grandTotalSqft }
