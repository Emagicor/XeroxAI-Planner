import { formatArea } from '../utils/exportTable'
import { roomColor } from '../constants/colors'
import { unitLabel } from '../utils/units'
import { confidenceColor, sourceBadgeClass } from '../utils/styles'

function methodToSource(method) {
  if (method === 'Label') return 'measured'
  if (method === 'Scale') return 'derived'
  if (method === 'Manual') return 'derived'
  return 'assumed'
}

export default function ReviewTable({
  rows,
  unit,
  activePage,
  activeRowId,
  onUpdateRow,
  onToggleIncluded,
  onAddRoom,
  onRowActivate,
}) {
  const ul = unitLabel(unit)
  const editable = rows.filter((r) => r.eligible !== false)

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line">
        <p className="text-sm text-[#8B8A82]">
          Check <span className="text-[#F0EEE8]">Include</span> to count a room in
          totals and exports.
        </p>
        <button
          type="button"
          onClick={() => onAddRoom(activePage)}
          className="px-3 py-1.5 rounded-lg border border-accent/40 bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20"
        >
          + Add room
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[#8B8A82]">
              <th className="px-3 py-2 font-medium w-10 text-center">Incl.</th>
              <th className="px-3 py-2 font-medium w-1" />
              <th className="px-3 py-2 font-medium">Page</th>
              <th className="px-3 py-2 font-medium">Area name</th>
              <th className="px-3 py-2 font-medium">Length (ft)</th>
              <th className="px-3 py-2 font-medium">Width (ft)</th>
              <th className="px-3 py-2 font-medium">Area ({ul})</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">Conf.</th>
              <th className="px-3 py-2 font-medium">Assumed</th>
            </tr>
          </thead>
          <tbody>
            {editable.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[#8B8A82]">
                  No rooms yet. Click &quot;Add room&quot; to create one.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              if (row.eligible === false) {
                return (
                  <tr
                    key={row.id}
                    className="border-b border-line/50 bg-red-950/20"
                  >
                    <td />
                    <td />
                    <td className="px-3 py-2 font-mono">{row.floor}</td>
                    <td colSpan={6} className="px-3 py-2 text-red-300/90 italic">
                      Ineligible: {row.notes}
                    </td>
                  </tr>
                )
              }

              const isActive = activeRowId === row.id
              const included = row.included !== false
              const swatch =
                row.colorIndex != null ? roomColor(row.colorIndex) : undefined

              return (
                <tr
                  key={row.id}
                  className={`border-b border-line/50 cursor-pointer transition-colors ${
                    isActive ? 'bg-surface' : 'hover:bg-surface/50'
                  } ${!included ? 'opacity-45' : ''} ${row.assumed ? 'bg-amber-950/10' : ''}`}
                  style={
                    swatch
                      ? { borderLeftWidth: 3, borderLeftColor: swatch }
                      : undefined
                  }
                  onMouseEnter={() => onRowActivate?.(row)}
                  onClick={() => onRowActivate?.(row)}
                >
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={(e) => onToggleIncluded(row.id, e.target.checked)}
                      className="w-4 h-4 rounded border-line accent-[#1D9E75] cursor-pointer"
                      title={included ? 'Included in total' : 'Excluded from total'}
                    />
                  </td>
                  <td className="pl-1 py-2">
                    {swatch && (
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: swatch }}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-[#8B8A82]">
                    {row.floor}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) =>
                        onUpdateRow(row.id, { name: e.target.value })
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="w-full min-w-[100px] bg-surface border border-line rounded px-2 py-1 text-[#F0EEE8]"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.lengthFt ?? ''}
                      onChange={(e) =>
                        onUpdateRow(row.id, {
                          lengthFt: e.target.value === '' ? null : e.target.value,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="w-20 bg-surface border border-line rounded px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={row.widthFt ?? ''}
                      onChange={(e) =>
                        onUpdateRow(row.id, {
                          widthFt: e.target.value === '' ? null : e.target.value,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      className="w-20 bg-surface border border-line rounded px-2 py-1 font-mono"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {formatArea(row.areaSqft, unit) ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs border ${sourceBadgeClass(methodToSource(row.method))}`}
                    >
                      {row.method}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`font-mono text-xs ${confidenceColor(row.confidencePct)}`}
                    >
                      {row.confidencePct}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.assumed ? (
                      <span className="text-amber-400 text-xs font-medium">Yes</span>
                    ) : (
                      <span className="text-[#8B8A82]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
