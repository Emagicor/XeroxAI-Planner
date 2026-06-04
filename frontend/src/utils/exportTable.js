import {
  buildEditedExportDocument,
  grandTotalSqft,
  includedRows,
  rowsToExportLines,
  tableRows,
} from './analysis'
import { convertAreaFromSqft, unitLabel } from './units'

export function downloadTableCSV(rows, unit, filename = 'floor_plan_areas.csv') {
  const csv = rowsToExportLines(rows, unit, convertAreaFromSqft, unitLabel)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyTableToClipboard(rows, unit) {
  const text = rowsToExportLines(rows, unit, convertAreaFromSqft, unitLabel)
  await navigator.clipboard.writeText(text)
}

export function downloadEditedJson(doc, unit, filename) {
  const payload = buildEditedExportDocument(
    doc,
    unit,
    convertAreaFromSqft,
    unitLabel,
  )
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportRowsForSheet(rows, unit) {
  const ul = unitLabel(unit)
  return tableRows(rows).map((r) => {
    const dims =
      r.lengthFt != null && r.widthFt != null
        ? `${r.lengthFt}' × ${r.widthFt}'`
        : ''
    return {
      Include: r.included !== false ? 'Yes' : 'No',
      'Page/Floor': r.floor,
      'Area Name': r.name,
      Dimensions: dims,
      [`Area (${ul})`]: convertAreaFromSqft(r.areaSqft, unit) ?? '',
      Method: r.method,
      'Confidence %': r.confidencePct,
      Assumed: r.assumed ? 'Yes' : 'No',
      Notes: r.notes ?? '',
    }
  })
}

export async function downloadTableXLSX(rows, unit, filename = 'floor_plan_areas.xlsx') {
  const XLSX = await import('xlsx')
  const sheetRows = exportRowsForSheet(rows, unit)
  const total = convertAreaFromSqft(grandTotalSqft(rows), unit)
  sheetRows.push({})
  sheetRows.push({
    'Area Name': 'Grand Total (included only)',
    [`Area (${unitLabel(unit)})`]: total ?? '',
  })

  const ws = XLSX.utils.json_to_sheet(sheetRows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Floor Plan Areas')
  XLSX.writeFile(wb, filename)
}

export function formatArea(sqft, unit) {
  if (sqft == null) return '—'
  return convertAreaFromSqft(sqft, unit)
}

export { grandTotalSqft, includedRows, buildEditedExportDocument }
