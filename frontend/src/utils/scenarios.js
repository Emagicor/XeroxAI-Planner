/** Human labels for document detection scenarios. */
export const SCENARIO_LABELS = {
  single_image_single_floorplan: 'Single image · 1 floor plan',
  single_pdf_single_page: 'Single PDF · 1 page',
  single_image_multi_floorplan: 'Single image · multiple floor plans',
  single_pdf_multi_page: 'Multi-page PDF',
  single_pdf_multi_page_multi_floorplan: 'Multi-page PDF · multi-plan pages',
  mixed: 'Mixed document',
}

export function scenarioLabel(scenario) {
  return SCENARIO_LABELS[scenario] ?? scenario ?? 'Document'
}

export function planFloorLabel(page) {
  const source = page.source_page ?? page.sourcePage ?? page.page
  const region = page.region_index ?? page.regionIndex
  if (region && region > 1) return `Page ${source} · Plan ${region}`
  if (source !== page.page && page.page != null) {
    return `Plan ${page.page} (page ${source})`
  }
  return `Page ${page.page ?? source}`
}

/** Short tab title: Page 1 · Plan 1, Page 2 · Plan 2, etc. */
export function planTabLabel(plan) {
  const sourcePage =
    plan.sourcePage ?? plan.source_page ?? plan.planNumber ?? 1
  const regionIndex = plan.regionIndex ?? plan.region_index ?? 1
  const planIdx = regionIndex > 1 ? regionIndex : plan.planNumber ?? 1
  return `Page ${sourcePage} · Plan ${planIdx}`
}
