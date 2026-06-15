import ExpandableImage from '@/components/ui/ExpandableImage'
import { inlineImageSrc } from '@/utils/inlineImage'

export default function PlanImagesPanel({
  floorLabel,
  clipPreview,
  compact = false,
  expandable = true,
  allowDownload = false,
  downloadBaseName = 'floor_plan',
  planNumber,
}) {
  const clipSrc = clipPreview ? inlineImageSrc(clipPreview) : null
  const pageSuffix = planNumber != null ? `_page${planNumber}` : ''

  if (!clipSrc) {
    return (
      <div className="rounded-xl border border-line bg-card/50 p-8 text-center text-muted text-sm">
        No plan image available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {floorLabel && (
        <p className="text-sm font-medium text-text">{floorLabel}</p>
      )}

      <ExpandableImage
        src={clipSrc}
        label="Floor plan region"
        alt="Clipped floor plan region"
        compact={compact}
        expandable={expandable}
        allowDownload={allowDownload}
        downloadFilename={`${downloadBaseName}${pageSuffix}_input.jpg`}
      />
    </div>
  )
}
