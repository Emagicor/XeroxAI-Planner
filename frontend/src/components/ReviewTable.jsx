import { formatArea } from '../utils/exportTable'
import { roomColor } from '../constants/colors'
import { unitLabel } from '../utils/units'
import { confidenceColor, sourceBadgeClass } from '../utils/styles'

function methodToSource(method) {
  if (method === 'Label') return 'measured'
  if (method === 'Scale') return 'derived'
  return 'assumed'
}

export default function ReviewTable({
  rows,
  unit,
  activeRowId,
  onUpdateRow,
  onRemoveRow,
  onRowActivate,
}) {
  const ul = unitLabel(unit)

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[#8B8A82]">
              <th className="px-3 py-2 font-medium w-1" />
              <th className="px-3 py-2 font-medium">Page</th>
              <th className="px-3 py-2 font-medium">Area name</th>
              <th className="px-3 py-2 font-medium">Length (ft)</th>
              <th className="px-3 py-2 font-medium">Width (ft)</th>
              <th className="px-3 py-2 font-medium">Area ({ul})</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 font-medium">Conf.</th>
              <th className="px-3 py-2 font-medium">Assumed</th>
              <th className="px-3 py-2 font-medium w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.removed) return null
              const isActive = activeRowId === row.id
              const swatch =
                row.colorIndex != null ? roomColor(row.colorIndex) : undefined

              if (!row.eligible) {
                return (
                  <tr
                    key={row.id}
                    className="border-b border-line/50 bg-red-950/20"
                  >
                    <td />
                    <td className="px-3 py-2 font-mono">{row.floor}</td>
                    <td colSpan={7} className="px-3 py-2 text-red-300/90 italic">
                      Ineligible: {row.notes}
                    </td>
                    <td />
                  </tr>
                )
              }
              return (
                <tr
                  key={row.id}
                  className={`border-b border-line/50 cursor-pointer transition-colors ${
                    isActive ? 'bg-surface' : 'hover:bg-surface/50'
                  } ${row.assumed ? 'bg-amber-950/10' : ''}`}
                  style={
                    swatch
                      ? { borderLeftWidth: 3, borderLeftColor: swatch }
                      : undefined
                  }
                  onMouseEnter={() => onRowActivate?.(row)}
                  onClick={() => onRowActivate?.(row)}
                >
                  <td className="pl-3 py-2">
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
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveRow(row.id)
                      }}
                      className="text-[#8B8A82] hover:text-red-400 text-lg leading-none"
                      title="Remove row"
                    >
                      ×
                    </button>
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
