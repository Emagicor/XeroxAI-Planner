/**
 * Normalize backend2.0 analyze responses into review rows + annotated pages.
 */

let _rowId = 0
function nextRowId() {
  _rowId += 1
  return `row-${_rowId}`
}

export function normalizeAnalyzeResponse(data) {
  const pages = data.pages ?? []
  const rows = []
  const ineligiblePages = []
  const annotatedPages = []

  for (const page of pages) {
    const pageNum = page.page_number ?? page.page ?? 0
    const eligible = page.eligible !== false
    const pageRooms = page.rooms ?? []

    const hasAnnotated =
      Boolean(page.has_annotated_image) || Boolean(page.annotated_image)

    if (hasAnnotated && eligible) {
      annotatedPages.push({
        page: pageNum,
        annotatedImage: page.annotated_image ?? null,
        hasAnnotated: true,
        rooms: pageRooms.map((r, i) => ({
          name: r.name,
          roomIndex: i,
          colorIndex: i,
        })),
        eligible,
      })
    }

    if (!eligible) {
      ineligiblePages.push({
        page: pageNum,
        reason: page.ineligible_reason ?? page.reason ?? 'Ineligible',
      })
      rows.push({
        id: nextRowId(),
        page: pageNum,
        floor: `Page ${pageNum}`,
        name: '—',
        lengthFt: null,
        widthFt: null,
        areaSqft: null,
        method: '—',
        confidencePct: 0,
        assumed: false,
        notes: page.ineligible_reason ?? page.reason ?? 'Ineligible page',
        eligible: false,
        removed: false,
        roomIndex: null,
      })
      continue
    }

    pageRooms.forEach((room, roomIndex) => {
      rows.push({
        id: room.room_id ?? nextRowId(),
        page: pageNum,
        floor: `Page ${pageNum}`,
        name: room.name ?? 'Unknown',
        lengthFt: room.length_ft ?? null,
        widthFt: room.width_ft ?? null,
        areaSqft: room.area_sqft ?? null,
        method: methodLabel(room.dimension_source),
        confidencePct: room.confidence_pct ?? 0,
        assumed: Boolean(room.is_assumed ?? room.dimension_source === 'assumed'),
        notes: (room.assumptions ?? []).join('; '),
        eligible: true,
        removed: false,
        roomIndex,
        colorIndex: roomIndex,
      })
    })
  }

  const firstAnnotated =
    annotatedPages.find((p) => p.eligible && p.annotatedImage) ??
    annotatedPages[0] ??
    null

  return {
    jobId: data.job_id ?? data.jobId ?? null,
    filename: data.filename ?? '',
    pageCount: data.total_pages ?? data.page_count ?? pages.length,
    grandTotalSqft: data.grand_total_sqft ?? 0,
    eligiblePages: data.eligible_pages ?? 0,
    ineligiblePages: data.ineligible_pages ?? ineligiblePages.length,
    ineligibleList: ineligiblePages,
    annotatedPages,
    defaultPage: firstAnnotated?.page ?? annotatedPages[0]?.page ?? 1,
    rows,
    raw: data,
  }
}

function methodLabel(source) {
  const map = {
    measured: 'Label',
    derived: 'Scale',
    assumed: 'Inferred',
  }
  return map[source] ?? source ?? '—'
}

export function recomputeRowArea(row) {
  const l = parseFloat(row.lengthFt)
  const w = parseFloat(row.widthFt)
  if (Number.isFinite(l) && Number.isFinite(w) && l > 0 && w > 0) {
    return { ...row, areaSqft: Math.round(l * w * 100) / 100 }
  }
  return row
}

export function activeRows(rows) {
  return rows.filter((r) => !r.removed && r.eligible !== false)
}

export function grandTotalSqft(rows) {
  return activeRows(rows).reduce((sum, r) => sum + (r.areaSqft ?? 0), 0)
}

export function rowsToExportLines(rows, unit, convertAreaFromSqft, unitLabelFn) {
  const header = [
    'Page/Floor',
    'Area Name',
    'Dimensions',
    `Computed Area (${unitLabelFn(unit)})`,
    'Method',
    'Confidence %',
    'Assumed?',
    'Notes',
  ]
  const lines = [header.join(',')]

  for (const r of activeRows(rows)) {
    const dims =
      r.lengthFt != null && r.widthFt != null
        ? `${r.lengthFt}' × ${r.widthFt}'`
        : '—'
    const area = convertAreaFromSqft(r.areaSqft, unit)
    lines.push(
      [
        `"${r.floor}"`,
        `"${(r.name || '').replace(/"/g, '""')}"`,
        `"${dims}"`,
        area ?? '',
        r.method,
        r.confidencePct,
        r.assumed ? 'Yes' : 'No',
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(','),
    )
  }
  const total = convertAreaFromSqft(grandTotalSqft(rows), unit)
  lines.push('')
  lines.push(`Grand Total,,,${total ?? ''},${unitLabelFn(unit)},,,`)
  return lines.join('\n')
}
