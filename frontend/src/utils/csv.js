export function downloadAnalysisCSV(result) {
  if (!result?.rooms) return

  const header =
    'Room,Length (ft),Width (ft),Area (sqft),Confidence (%),Source,Assumptions'
  const rows = result.rooms.map((r) => {
    const assumptions = (r.assumptions || []).join(' | ')
    return [
      `"${(r.name || '').replace(/"/g, '""')}"`,
      r.length_ft ?? '',
      r.width_ft ?? '',
      r.area_sqft ?? '',
      r.confidence_pct ?? '',
      r.dimension_source ?? '',
      `"${assumptions.replace(/"/g, '""')}"`,
    ].join(',')
  })

  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'floor_plan_analysis.csv'
  a.click()
  URL.revokeObjectURL(url)
}
