/**
 * Build ground-truth JSON from the edited review table (upload-compatible format).
 */
import { includedRows } from '../analysis'

function methodToSource(method) {
  if (method === 'Label') return 'measured'
  if (method === 'Scale') return 'derived'
  if (method === 'Manual') return 'derived'
  if (method === 'Inferred') return 'assumed'
  return 'measured'
}

function rowToGroundTruthRoom(row) {
  const room = {
    name: row.name || 'Unknown',
  }

  if (row.lengthFt != null && row.lengthFt !== '') {
    room.length_ft = Number(row.lengthFt)
  }
  if (row.widthFt != null && row.widthFt !== '') {
    room.width_ft = Number(row.widthFt)
  }
  if (row.areaSqft != null && row.areaSqft !== '') {
    room.area_sqft = Number(row.areaSqft)
  }

  if (row.method && row.method !== '—') {
    room.dimension_source = methodToSource(row.method)
  }
  if (row.notes) {
    room.assumptions = row.notes.split(';').map((s) => s.trim()).filter(Boolean)
  }

  return room
}

/**
 * @param {import('../analysis').doc} doc - review doc with rows
 * @param {{ includedOnly?: boolean }} options
 */
export function buildGroundTruthDocument(doc, { includedOnly = true } = {}) {
  const source = includedOnly ? includedRows(doc.rows) : doc.rows.filter((r) => r.eligible !== false)

  const byPage = new Map()

  for (const row of source) {
    const pageNum = row.page ?? 1
    if (!byPage.has(pageNum)) {
      byPage.set(pageNum, [])
    }
    byPage.get(pageNum).push(rowToGroundTruthRoom(row))
  }

  const pages = [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page_number, rooms]) => ({ page_number, rooms }))

  return {
    filename: doc.filename ?? null,
    exported_at: new Date().toISOString(),
    pages,
  }
}

export function downloadGroundTruthJson(doc, filename = 'ground_truth.json') {
  const payload = buildGroundTruthDocument(doc)
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
