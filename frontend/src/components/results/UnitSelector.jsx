import { AREA_UNITS } from '@/utils/units'

export default function UnitSelector({ unit, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted">Unit</span>
      <select
        value={unit}
        onChange={(e) => onChange(e.target.value)}
        className="select"
      >
        {AREA_UNITS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.label}
          </option>
        ))}
      </select>
    </div>
  )
}
