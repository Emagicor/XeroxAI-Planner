import { roomColor } from '@/constants/colors'
import {
  confidenceBarColor,
  confidenceColor,
  sourceBadgeClass,
} from '@/utils/styles'

export default function RoomTable({ rooms, activeRoom, onSelectRoom }) {
  if (!rooms?.length) return null

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-3 py-2 font-medium">Room</th>
              <th className="px-3 py-2 font-medium">Dimensions</th>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Assumptions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, i) => (
              <tr
                key={`${room.name}-${i}`}
                className={`border-b border-line/50 transition-colors cursor-pointer ${
                  activeRoom === i ? 'bg-surface' : 'hover:bg-surface/50'
                }`}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: roomColor(i),
                }}
                onMouseEnter={() => onSelectRoom(i)}
                onClick={() => onSelectRoom(i)}
              >
                <td className="px-3 py-2 font-medium">{room.name}</td>
                <td className="px-3 py-2 font-mono text-muted">
                  {room.length_ft} × {room.width_ft} ft
                </td>
                <td className="px-3 py-2 font-mono">{room.area_sqft} sqft</td>
                <td className="px-3 py-2">
                  <span
                    className={`font-mono font-medium ${confidenceColor(room.confidence_pct)}`}
                  >
                    {room.confidence_pct}%
                  </span>
                  <div className="mt-1 h-1 w-16 rounded-full bg-line overflow-hidden">
                    <div
                      className={`h-full rounded-full ${confidenceBarColor(room.confidence_pct)}`}
                      style={{ width: `${room.confidence_pct}%` }}
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs border capitalize ${sourceBadgeClass(room.dimension_source)}`}
                  >
                    {room.dimension_source}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs italic text-muted max-w-[140px]">
                  {room.assumptions?.length > 0
                    ? room.assumptions.join('; ')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
