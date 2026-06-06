/** Build progress item list from detection response. */
export function buildAnalyzeProgressItems(detection) {
  const items = []
  for (const page of detection?.pages ?? []) {
    if (page.skipped) continue
    for (const region of page.regions ?? []) {
      items.push({
        id: region.region_id,
        planNumber: items.length + 1,
        sourcePage: page.page_number,
        regionIndex: region.region_index,
        label: `Page ${page.page_number}${region.region_index > 1 ? ` · Plan ${region.region_index}` : ''}`,
        clipPreview: region.preview_image,
        status: 'pending',
        message: null,
      })
    }
  }
  return items
}
