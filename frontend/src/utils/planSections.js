import { planFloorLabel } from './scenarios'

/**
 * Plan sections from normalized review doc.
 */
export function groupDocByPlan(doc) {
  if (!doc?.pageSummaries?.length) return []

  return doc.pageSummaries
    .filter((s) => s.eligible !== false)
    .map((summary) => {
      const preview = doc.planPreviews?.find((a) => a.page === summary.page)
      const rows = (doc.rows ?? []).filter(
        (r) => r.page === summary.page && r.eligible !== false,
      )
      return {
        planNumber: summary.page,
        sourcePage: summary.sourcePage ?? summary.page,
        regionIndex: summary.regionIndex ?? 1,
        floorLabel: summary.floorLabel ?? `Page ${summary.page}`,
        clipPreview: summary.clipPreview ?? preview?.clipPreview ?? null,
        totalAreaSqft: summary.totalAreaSqft ?? 0,
        roomCount: summary.roomCount ?? rows.length,
        rows,
      }
    })
}

/**
 * Plan sections from raw POST /analyze JSON (test suite).
 */
export function extractPlanSectionsFromAnalyze(data) {
  const pages = (data?.pages ?? []).filter((p) => p.eligible !== false)

  return pages.map((page) => {
    const planNumber = page.page_number ?? page.page ?? 0
    return {
      planNumber,
      sourcePage: page.source_page ?? planNumber,
      regionIndex: page.region_index ?? 1,
      floorLabel: planFloorLabel({
        page: planNumber,
        source_page: page.source_page,
        region_index: page.region_index,
      }),
      clipPreview: page.clip_preview ?? null,
      totalAreaSqft: Number(page.total_area_sqft ?? 0),
      roomCount: (page.rooms ?? []).length,
      rooms: page.rooms ?? [],
    }
  })
}

export function isMultiPlanDoc(doc) {
  const plans = groupDocByPlan(doc)
  return plans.length > 1
}

export function isMultiPlanAnalyze(data) {
  const plans = extractPlanSectionsFromAnalyze(data)
  return plans.length > 1
}
