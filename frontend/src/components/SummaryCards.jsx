import { unitLabel } from '../utils/units'
import { confidenceColor } from '../utils/styles'

function StatCard({ label, children }) {
  return (
    <div className="bg-card border border-line rounded-lg p-4">
      <p className="text-xs text-[#8B8A82] mb-1">{label}</p>
      {children}
    </div>
  )
}

export default function SummaryCards({ doc, displayTotal, unit, roomCount }) {
  if (!doc) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatCard label="Grand total">
        <p className="font-mono text-lg font-medium text-[#F0EEE8]">
          {displayTotal}{' '}
          <span className="text-sm text-[#8B8A82]">{unitLabel(unit)}</span>
        </p>
      </StatCard>
      <StatCard label="Pages">
        <p className="font-mono text-lg font-medium text-[#F0EEE8]">
          {doc.pageCount}{' '}
          <span className="text-sm text-[#8B8A82]">
            ({doc.eligiblePages} ok, {doc.ineligiblePages} skip)
          </span>
        </p>
      </StatCard>
      <StatCard label="Rooms">
        <p className="font-mono text-lg font-medium text-[#F0EEE8]">
          {roomCount}
        </p>
      </StatCard>
      <StatCard label="File">
        <p className="text-sm text-[#F0EEE8] truncate" title={doc.filename}>
          {doc.filename || '—'}
        </p>
      </StatCard>
    </div>
  )
}
