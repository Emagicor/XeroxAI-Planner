import ExpandableImage from '@/components/ui/ExpandableImage'
import RoomLegend from './RoomLegend'
import { inlineImageSrc, resolveAnnotatedSrc } from '@/utils/annotatedImage'

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
  compact = false,
  expandable = true,
  allowDownload = false,
  downloadBaseName = 'floor_plan',
}) {
  const clipSrc = clipPreview ? inlineImageSrc(clipPreview) : null

  const annotatedSrc =
    resolveAnnotatedSrc({
      jobId,
      page: planNumber,
      inlineBase64: annotatedImage,
      hasAnnotated,
    }) ?? null

  const showBoth = clipSrc && annotatedSrc && annotatedSrc !== clipSrc
  const pageSuffix = planNumber != null ? `_page${planNumber}` : ''

  if (!clipSrc && !annotatedSrc) {
    return (
      <div className="rounded-xl border border-line bg-card/50 p-8 text-center text-muted text-sm">
        No plan images available
      </div>
    )
  }

  const gridClass = compact
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
    : 'space-y-4'

  const singleSrc = annotatedSrc ?? clipSrc
  const isClipOnly = clipSrc && !annotatedSrc
  const singleFilename = isClipOnly
    ? `${downloadBaseName}${pageSuffix}_input.jpg`
    : `${downloadBaseName}${pageSuffix}_annotated.jpg`

  return (
    <div className="space-y-4">
      {floorLabel && (
        <p className="text-sm font-medium text-text">{floorLabel}</p>
      )}

      {showBoth ? (
        <div className={gridClass}>
          <ExpandableImage
            src={clipSrc}
            label="Floor plan region"
            alt="Clipped floor plan region"
            compact={compact}
            expandable={expandable}
            allowDownload={allowDownload}
            downloadFilename={`${downloadBaseName}${pageSuffix}_input.jpg`}
          />
          <ExpandableImage
            src={annotatedSrc}
            label="Annotated analysis"
            alt="Annotated floor plan"
            compact={compact}
            expandable={expandable}
            allowDownload={allowDownload}
            downloadFilename={`${downloadBaseName}${pageSuffix}_annotated.jpg`}
          />
        </div>
      ) : (
        <ExpandableImage
          src={singleSrc}
          label={isClipOnly ? 'Floor plan region' : undefined}
          alt={isClipOnly ? 'Clipped floor plan region' : 'Annotated floor plan'}
          compact={compact}
          expandable={expandable}
          allowDownload={allowDownload}
          downloadFilename={singleFilename}
        />
      )}

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
