import { AREA_UNITS } from '@/utils/units'

export default function UnitSelector({ unit, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">Unit</span>
      <select
        value={unit}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-line/80 rounded-xl px-3 py-2 text-sm text-text font-medium hover:border-accent/30 transition-colors cursor-pointer"
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
