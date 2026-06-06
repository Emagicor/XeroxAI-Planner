import { useState } from 'react'

import AnnotatedImagePanel from './AnnotatedImagePanel'

import RoomLegend from './RoomLegend'

import { resolveAnnotatedSrc } from '@/utils/annotatedImage'



function ClipImage({ src, label = 'Clipped region' }) {

  if (!src) return null

  return (

    <div className="min-w-0 rounded-xl border border-line/60 bg-[#0a0a0c]/50 p-3">

      <p className="text-[10px] uppercase tracking-wide text-muted mb-2">{label}</p>

      <img

        src={src}

        alt={label}

        className="w-full rounded-lg border border-line bg-[#0a0a0c] object-contain max-h-[min(520px,70vh)]"

      />

    </div>

  )

}



export default function PlanImagesPanel({

  floorLabel,

  clipPreview,

  jobId,

  planNumber,

  annotatedImage,

  hasAnnotated,

  rooms,

  activeRoom,

  onSelectRoom,

}) {

  const [imgError, setImgError] = useState(false)



  const clipSrc = clipPreview

    ? clipPreview.startsWith('data:')

      ? clipPreview

      : `data:image/jpeg;base64,${clipPreview}`

    : null



  const annotatedSrc =

    resolveAnnotatedSrc({

      jobId,

      page: planNumber,

      inlineBase64: annotatedImage,

      hasAnnotated,

    }) ?? null



  const showBoth = clipSrc && annotatedSrc && annotatedSrc !== clipSrc



  if (!clipSrc && !annotatedSrc) {

    return (

      <div className="rounded-xl border border-line bg-card/50 p-8 text-center text-muted text-sm">

        No plan images available

      </div>

    )

  }



  if (showBoth) {

    return (

      <div className="space-y-4">

        {floorLabel && (

          <p className="text-sm font-medium text-text">{floorLabel}</p>

        )}

        <div className="space-y-4">

          <ClipImage src={clipSrc} label="Clipped region (detected floor plan)" />

          <div className="min-w-0 rounded-xl border border-line/60 bg-[#1a1a18]/40 p-3">

            <p className="text-[10px] uppercase tracking-wide text-muted mb-2">

              Annotated analysis

            </p>

            {!imgError && annotatedSrc ? (

              <img

                src={annotatedSrc}

                alt="Annotated floor plan"

                className="w-full rounded-lg border border-line shadow-lg bg-[#1a1a18] object-contain max-h-[min(520px,70vh)]"

                onError={() => setImgError(true)}

              />

            ) : (

              <AnnotatedImagePanel

                imageSrc={annotatedSrc}

                inlineBase64={annotatedImage}

                rooms={[]}

              />

            )}

          </div>

        </div>

        {rooms?.length > 0 && (

          <RoomLegend

            rooms={rooms}

            activeRoom={activeRoom}

            onSelectRoom={onSelectRoom}

          />

        )}

      </div>

    )

  }



  const singleSrc = annotatedSrc ?? clipSrc

  return (

    <div className="space-y-3">

      {floorLabel && (

        <p className="text-sm font-medium text-text">{floorLabel}</p>

      )}

      {clipSrc && !annotatedSrc && (

        <p className="text-[10px] uppercase tracking-wide text-muted">

          Clipped region (detected floor plan)

        </p>

      )}

      <AnnotatedImagePanel

        imageSrc={singleSrc}

        inlineBase64={annotatedImage ?? (clipPreview && !clipPreview.startsWith('data:') ? clipPreview : null)}

        rooms={rooms}

        activeRoom={activeRoom}

        onSelectRoom={onSelectRoom}

      />

    </div>

  )

}


