/** Area display units — base storage is always sqft on each row. */
export const AREA_UNITS = [
  { id: 'sqft', label: 'sq ft' },
  { id: 'sqm', label: 'sq m' },
  { id: 'sq-in', label: 'sq in' },
  { id: 'sq-cm', label: 'sq cm' },
]

const SQFT_TO = {
  sqft: 1,
  sqm: 0.092903,
  'sq-in': 144,
  'sq-cm': 929.03,
}

export function convertAreaFromSqft(sqft, unit) {
  if (sqft == null || Number.isNaN(sqft)) return null
  const factor = SQFT_TO[unit] ?? 1
  return Math.round(sqft * factor * 100) / 100
}

export function unitLabel(unit) {
  return AREA_UNITS.find((u) => u.id === unit)?.label ?? unit
}
