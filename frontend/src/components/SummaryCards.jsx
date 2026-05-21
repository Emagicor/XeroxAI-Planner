import { confidenceColor } from '../utils/styles'

function StatCard({ label, children }) {
  return (
    <div className="bg-card border border-line rounded-lg p-4">
      <p className="text-xs text-[#8B8A82] mb-1">{label}</p>
      {children}
    </div>
  )
}

export default function SummaryCards({ result }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Area">
          <p className="font-mono text-lg font-medium text-[#F0EEE8]">
            {result.total_area_sqft}{' '}
            <span className="text-sm text-[#8B8A82]">sqft</span>
          </p>
          {result.total_area_source === 'layout_dimensions' &&
            result.layout_dimensions_used && (
              <p className="text-[10px] text-[#8B8A82] mt-1 font-mono leading-tight">
                {result.layout_dimensions_used.width_ft} ×{' '}
                {result.layout_dimensions_used.height_ft} ft (plan outline)
              </p>
            )}
          {result.total_area_source === 'room_sum' && (
            <p className="text-[10px] text-[#8B8A82] mt-1">Sum of room areas</p>
          )}
        </StatCard>
        <StatCard label="Rooms Found">
          <p className="font-mono text-lg font-medium text-[#F0EEE8]">
            {result.rooms?.length ?? 0}
          </p>
        </StatCard>
        <StatCard label="Overall Confidence">
          <p
            className={`font-mono text-lg font-medium ${confidenceColor(result.overall_confidence ?? 0)}`}
          >
            {result.overall_confidence}%
          </p>
        </StatCard>
      </div>

      {result.units_detected && (
        <p className="text-xs text-[#8B8A82] mb-4 font-mono">
          Units detected: {result.units_detected}
        </p>
      )}
    </>
  )
}
