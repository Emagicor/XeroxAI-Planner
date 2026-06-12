import { unitLabel } from '@/utils/units'

function StatCard({ label, value, detail }) {
  return (
    <div className="bg-card border border-line rounded-lg p-4 hover:border-accent/20 transition-colors duration-150">
      <p className="stat-label">{label}</p>
      <p className="font-mono text-lg font-semibold text-text">{value}</p>
      {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
    </div>
  )
}

export default function SummaryCards({ doc, displayTotal, unit, roomCount }) {
  if (!doc) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatCard
        label="File"
        value={
          <span className="text-sm truncate block" title={doc.filename}>
            {doc.filename || "—"}
          </span>
        }
      />
      <StatCard
        label="Pages"
        value={doc.pageCount}
        detail={`${doc.eligiblePages} plan${doc.eligiblePages !== 1 ? "s" : ""}, ${doc.ineligiblePages} skipped`}
      />
      <StatCard label="Rooms" value={roomCount} />
      <StatCard
        label="Grand total"
        value={
          <>
            {displayTotal}{" "}
            <span className="text-sm text-muted font-normal">
              {unitLabel(unit)}
            </span>
          </>
        }
      />
    </div>
  );
}
