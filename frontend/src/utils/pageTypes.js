const LABELS = {
  floorplan: 'Floor plan',
  cover: 'Cover / title',
  notes: 'Notes',
  schedule: 'Schedule',
  elevation: 'Elevation',
  section: 'Section',
  unknown: 'Unknown',
}

export function pageTypeLabel(pageType) {
  if (!pageType) return 'Non-plan'
  return LABELS[String(pageType).toLowerCase()] ?? pageType
}

export function pageTypeTone(pageType) {
  const t = String(pageType || '').toLowerCase()
  if (t === 'floorplan') return 'text-emerald-400'
  if (t === 'cover' || t === 'notes') return 'text-amber-300'
  return 'text-muted'
}
