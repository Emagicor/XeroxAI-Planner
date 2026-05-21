import RoomLegend from './RoomLegend'

export default function AnnotatedImagePanel({
  annotatedImage,
  rooms,
  activeRoom,
  onSelectRoom,
}) {
  return (
    <div className="lg:w-[60%]">
      {annotatedImage && (
        <img
          src={`data:image/jpeg;base64,${annotatedImage}`}
          alt="Annotated floor plan"
          className="w-full rounded-xl border border-line shadow-xl"
        />
      )}
      <RoomLegend
        rooms={rooms}
        activeRoom={activeRoom}
        onSelectRoom={onSelectRoom}
      />
    </div>
  )
}
