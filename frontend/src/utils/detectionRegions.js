/** Collect region IDs flagged for auto-exclusion (dimension tables). */
export function suggestedExcludeIds(detection) {
  const ids = []
  for (const page of detection?.pages ?? []) {
    for (const region of page.regions ?? []) {
      if (region.suggested_exclude) ids.push(region.region_id)
    }
  }
  return ids
}

/** Count regions that will be analyzed (not excluded). */
export function activeRegionCount(detection, excludedIds) {
  const excluded = excludedIds instanceof Set ? excludedIds : new Set(excludedIds ?? [])
  let count = 0
  for (const page of detection?.pages ?? []) {
    for (const region of page.regions ?? []) {
      if (!excluded.has(region.region_id)) count += 1
    }
  }
  return count
}

/** Build analyze progress items for non-excluded regions only. */
export function buildActiveProgressItems(detection, excludedIds, buildItems) {
  const excluded = excludedIds instanceof Set ? excludedIds : new Set(excludedIds ?? [])
  return buildItems(detection).filter((item) => !excluded.has(item.id))
}

export function regionKindLabel(kind) {
  if (kind === 'dimension_table') return 'Dimension table'
  if (kind === 'floor_plan') return 'Floor plan'
  return 'Unknown'
}
