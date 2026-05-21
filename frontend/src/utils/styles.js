export function confidenceColor(pct) {
  if (pct >= 80) return 'text-[#106E56]'
  if (pct >= 50) return 'text-[#854F0B]'
  return 'text-[#993C1D]'
}

export function confidenceBarColor(pct) {
  if (pct >= 80) return 'bg-[#106E56]'
  if (pct >= 50) return 'bg-[#854F0B]'
  return 'bg-[#993C1D]'
}

export function sourceBadgeClass(source) {
  if (source === 'measured') return 'bg-accent/20 text-accent border-accent/40'
  if (source === 'derived') return 'bg-[#BA7517]/20 text-[#D4A574] border-[#BA7517]/40'
  return 'bg-[#D85A30]/20 text-[#E8A090] border-[#D85A30]/40'
}
