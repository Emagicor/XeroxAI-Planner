/**
 * Normalize backend2.0 analyze responses into review rows + plan previews.
 */

import { pageTypeLabel } from './pageTypes'
import { planFloorLabel } from './scenarios'

let _rowId = 0
function nextRowId() {
  _rowId += 1
  return `row-${_rowId}`
}

export function normalizeAnalyzeResponse(data) {
  const pages = data.pages ?? []
  const rows = []
  const ineligiblePages = []
  const planPreviews = []
  const pageSummaries = []

  for (const page of pages) {
    const pageNum = page.plan_number ?? page.page_number ?? page.page ?? 0
    const sourcePage = page.source_page ?? page.sourcePage ?? page.page_number ?? pageNum
    const eligible = page.eligible !== false
    const pageType = page.page_type ?? page.pageType ?? (eligible ? 'floorplan' : 'unknown')
    const pageRooms = page.rooms ?? []
    const floorLabel = page.floor_label ?? planFloorLabel({
      page: pageNum,
      source_page: sourcePage,
      region_index: page.region_index,
    })

    pageSummaries.push({
      page: pageNum,
      planNumber: pageNum,
      sourcePage,
      regionIndex: page.region_index ?? 1,
      eligible,
      pageType,
      reason: page.ineligible_reason ?? page.reason ?? null,
      roomCount: eligible ? pageRooms.length : 0,
      totalAreaSqft: eligible ? Number(page.total_area_sqft ?? 0) : 0,
      label: pageTypeLabel(pageType),
      floorLabel,
      regionLabel: page.region_label ?? null,
      detectionConfidence: page.detection_confidence ?? null,
      detectionMethod: page.detection_method ?? null,
      clipPreview: page.clip_preview ?? null,
    })

    const clipPreview = page.clip_preview ?? null

    if (clipPreview && eligible) {
      planPreviews.push({
        page: pageNum,
        floorLabel,
        clipPreview,
        eligible,
      })
    }

    if (!eligible) {
      ineligiblePages.push({
        page: pageNum,
        pageType,
        label: pageTypeLabel(pageType),
        reason: page.ineligible_reason ?? page.reason ?? 'Ineligible',
      })
      rows.push({
        id: nextRowId(),
        page: pageNum,
        planNumber: pageNum,
        sourcePage,
        floor: floorLabel,
        name: '—',
        lengthFt: null,
        widthFt: null,
        areaSqft: null,
        method: '—',
        confidencePct: 0,
        assumed: false,
        notes: page.ineligible_reason ?? page.reason ?? 'Ineligible page',
        eligible: false,
        included: false,
        roomIndex: null,
        pageType,
      })
      continue
    }

    pageRooms.forEach((room, roomIndex) => {
      rows.push({
        id: room.room_id ?? nextRowId(),
        page: pageNum,
        planNumber: pageNum,
        sourcePage,
        floor: floorLabel,
        name: room.name ?? 'Unknown',
        lengthFt: room.length_ft ?? null,
        widthFt: room.width_ft ?? null,
        areaSqft: room.area_sqft ?? null,
        method: methodLabel(room.dimension_source),
        confidencePct: room.confidence_pct ?? 0,
        assumed: Boolean(room.is_assumed ?? room.dimension_source === 'assumed'),
        notes: (room.assumptions ?? []).join('; '),
        eligible: true,
        included: true,
        roomIndex,
        colorIndex: roomIndex,
        isManual: false,
      })
    })
  }

  const firstPreview =
    planPreviews.find((p) => p.eligible) ?? planPreviews[0] ?? null

  const doc = {
    jobId: data.job_id ?? data.jobId ?? null,
    filename: data.filename ?? '',
    pageCount: data.total_pages ?? data.page_count ?? pages.length,
    sourcePageCount: data.source_page_count ?? null,
    totalRegions: data.total_regions ?? pages.length,
    scenario: data.scenario ?? null,
    eligiblePages: data.eligible_pages ?? 0,
    ineligiblePages: data.ineligible_pages ?? ineligiblePages.length,
    ineligibleList: ineligiblePages,
    pageSummaries,
    planPreviews,
    visionUsage: data.vision_usage ?? null,
    defaultPage: firstPreview?.page ?? planPreviews[0]?.page ?? 1,
    rows,
    raw: data,
  }
  doc.grandTotalSqft = grandTotalSqft(rows)
  return doc
}

/** Rows shown in the review table (eligible + user-added). */
export function tableRows(rows) {
  return rows.filter((r) => r.eligible !== false)
}

/** Rows included in totals and primary export. */
export function includedRows(rows) {
  return rows.filter((r) => r.eligible !== false && r.included !== false)
}

/** @deprecated use includedRows */
export function activeRows(rows) {
  return includedRows(rows)
}

export function createEmptyRoom(page, colorIndex = 0) {
  return {
    id: nextRowId(),
    page,
    floor: `Page ${page}`,
    name: 'New room',
    lengthFt: null,
    widthFt: null,
    areaSqft: null,
    method: 'Manual',
    confidencePct: 0,
    assumed: false,
    notes: '',
    eligible: true,
    included: true,
    isManual: true,
    roomIndex: null,
    colorIndex,
  }
}

export function rowToExportRecord(row, unit, convertAreaFromSqft, unitLabelFn) {
  const dims =
    row.lengthFt != null && row.widthFt != null
      ? `${row.lengthFt}' × ${row.widthFt}'`
      : ''
  return {
    page_floor: row.floor,
    page: row.page,
    plan_number: row.planNumber ?? row.page,
    source_page: row.sourcePage ?? row.page,
    area_name: row.name,
    length_ft: row.lengthFt,
    width_ft: row.widthFt,
    dimensions: dims,
    area_sqft: row.areaSqft,
    computed_area: convertAreaFromSqft(row.areaSqft, unit),
    unit: unitLabelFn(unit),
    method: row.method,
    confidence_pct: row.confidencePct,
    assumed: row.assumed,
    included: row.included !== false,
    notes: row.notes ?? '',
  }
}

export function buildEditedExportDocument(doc, unit, convertAreaFromSqft, unitLabelFn) {
  const all = tableRows(doc.rows)
  const included = includedRows(doc.rows)
  const totalSqft = grandTotalSqft(doc.rows)

  return {
    exported_at: new Date().toISOString(),
    source_job_id: doc.jobId,
    filename: doc.filename,
    unit,
    unit_label: unitLabelFn(unit),
    grand_total_sqft: totalSqft,
    grand_total_display: convertAreaFromSqft(totalSqft, unit),
    rooms_included: included.length,
    rooms_in_table: all.length,
    rows: all.map((r) => rowToExportRecord(r, unit, convertAreaFromSqft, unitLabelFn)),
    pages_summary: doc.pageCount,
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

export function grandTotalSqft(rows) {
  return includedRows(rows).reduce((sum, r) => sum + (r.areaSqft ?? 0), 0)
}

export function rowsToExportLines(rows, unit, convertAreaFromSqft, unitLabelFn) {
  const header = [
    'Include',
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

  for (const r of tableRows(rows)) {
    const dims =
      r.lengthFt != null && r.widthFt != null
        ? `${r.lengthFt}' × ${r.widthFt}'`
        : '—'
    const area = convertAreaFromSqft(r.areaSqft, unit)
    lines.push(
      [
        r.included !== false ? 'Yes' : 'No',
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
  lines.push(`Grand Total (included only),,,${total ?? ''},${unitLabelFn(unit)},,,`)
  return lines.join('\n')
}
