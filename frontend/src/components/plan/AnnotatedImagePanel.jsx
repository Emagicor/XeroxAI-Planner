import { useState } from 'react'
import RoomLegend from './RoomLegend'
import { inlineAnnotatedSrc } from '@/utils/annotatedImage'

export default function AnnotatedImagePanel({
  imageSrc,
  inlineBase64,
  rooms,
  activeRoom,
  onSelectRoom,
}) {
  const [imgError, setImgError] = useState(false)

  const fallbackSrc = inlineAnnotatedSrc(inlineBase64)
  const src = !imgError && imageSrc ? imageSrc : fallbackSrc

  return (
    <div className="w-full">
      {src ? (
        <img
          src={src}
          alt="Annotated floor plan"
          className="w-full rounded-xl border border-line shadow-xl bg-[#1a1a18] object-contain max-h-[min(520px,70vh)]"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full aspect-[4/3] rounded-xl border border-line bg-card/50 flex items-center justify-center text-muted text-sm">
          Annotated preview unavailable
        </div>
      )}
      <RoomLegend
        rooms={rooms}
        activeRoom={activeRoom}
        onSelectRoom={onSelectRoom}
      />
    </div>
  )
}
