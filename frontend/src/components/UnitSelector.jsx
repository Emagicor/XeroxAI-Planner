import { AREA_UNITS } from '../utils/units'

export default function UnitSelector({ unit, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#8B8A82]">Output unit</span>
      <select
        value={unit}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-line rounded-lg px-3 py-1.5 text-sm text-[#F0EEE8]"
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
