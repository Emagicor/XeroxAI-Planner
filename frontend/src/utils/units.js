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

/** Linear factor from feet to the display unit paired with each area unit. */
const FT_TO_LINEAR = {
  sqft: 1,
  sqm: 0.3048,
  'sq-in': 12,
  'sq-cm': 30.48,
}

const LINEAR_UNIT_LABELS = {
  sqft: 'ft',
  sqm: 'm',
  'sq-in': 'in',
  'sq-cm': 'cm',
}

export function convertAreaFromSqft(sqft, unit) {
  if (sqft == null || Number.isNaN(sqft)) return null
  const factor = SQFT_TO[unit] ?? 1
  return Math.round(sqft * factor * 100) / 100
}

export function convertLengthFromFt(ft, unit) {
  if (ft == null || ft === '' || Number.isNaN(Number(ft))) return null
  const factor = FT_TO_LINEAR[unit] ?? 1
  return Math.round(Number(ft) * factor * 100) / 100
}

export function convertLengthToFt(display, unit) {
  if (display == null || display === '') return null
  const num = parseFloat(display)
  if (!Number.isFinite(num)) return null
  const factor = FT_TO_LINEAR[unit] ?? 1
  return Math.round((num / factor) * 100) / 100
}

export function unitLabel(unit) {
  return AREA_UNITS.find((u) => u.id === unit)?.label ?? unit
}

export function linearUnitLabel(unit) {
  return LINEAR_UNIT_LABELS[unit] ?? 'ft'
}
