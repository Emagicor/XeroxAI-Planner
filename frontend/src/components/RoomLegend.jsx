import { roomColor } from '../constants/colors'

export default function RoomLegend({ rooms, activeRoom, onSelectRoom }) {
  if (!rooms?.length) return null

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      {rooms.map((room, i) => (
        <button
          key={`${room.name}-${i}`}
          type="button"
          onClick={() => onSelectRoom(i)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
            activeRoom === i
              ? 'border-accent bg-accent/10'
              : 'border-line bg-card hover:border-accent/40'
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: roomColor(i) }}
          />
          {room.name}
        </button>
      ))}
    </div>
  )
}
