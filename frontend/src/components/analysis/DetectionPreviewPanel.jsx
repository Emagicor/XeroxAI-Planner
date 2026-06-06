import { scenarioLabel } from '@/utils/scenarios'
import { activeRegionCount, regionKindLabel } from '@/utils/detectionRegions'
import Card, { CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
// panel to display the clipped images and their status
function RegionThumb({ region, excluded, onToggle }) {
  const src = region.preview_image
    ? `data:image/jpeg;base64,${region.preview_image}`
    : null
  const isTable = region.region_kind === 'dimension_table'
  const isExcluded = excluded

  return (
    <div
      className={[
        'relative rounded-xl border overflow-hidden transition-all',
        isExcluded
          ? 'border-line/40 bg-surface/20 opacity-50'
          : 'border-line/60 bg-surface/40 hover:border-accent/30',
        isTable && !isExcluded ? 'ring-1 ring-amber-500/30' : '',
      ].join(' ')}
    >
      {src ? (
        <img
          src={src}
          alt={region.label}
          className={`w-full h-36 object-contain bg-[#0a0a0c] ${isExcluded ? 'grayscale' : ''}`}
        />
      ) : (
        <div className="h-36 flex items-center justify-center text-xs text-muted">
          No preview
        </div>
      )}

      <div className="px-3 py-2.5 border-t border-line/50 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-text truncate">
              Plan {region.region_index}
              {region.label ? ` · ${region.label}` : ''}
            </p>
            <p className="text-[10px] text-muted font-mono mt-0.5">
              {Math.round((region.confidence ?? 0) * 100)}% confidence
              {region.detection_method === 'full_page_fallback' && ' · full page'}
            </p>
          </div>
          <Button
            variant={isExcluded ? 'secondary' : 'danger'}
            size="sm"
            onClick={() => onToggle(region.region_id)}
            className="shrink-0 !px-2 !py-1"
            title={isExcluded ? 'Include in analysis' : 'Exclude from analysis'}
          >
            {isExcluded ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {region.region_kind && region.region_kind !== 'unknown' && (
            <Badge variant={isTable ? 'warning' : 'accent'} className="!text-[9px]">
              {regionKindLabel(region.region_kind)}
            </Badge>
          )}
          {region.suggested_exclude && isExcluded && (
            <Badge variant="warning" className="!text-[9px]">Auto-excluded</Badge>
          )}
          {isExcluded && (
            <Badge className="!text-[9px]">Skipped</Badge>
          )}
        </div>
      </div>
    </div>
  )
}
//Main panel for Clipped Images Display
export default function DetectionPreviewPanel({
  file,
  detection,
  detecting,
  modelAvailable,
  modelError,
  onChangeFile,
  excludedRegionIds,
  onToggleRegion,
}) {
  if (!detection && !detecting) return null

  const excluded = excludedRegionIds ?? new Set()
  const pages = detection?.pages ?? []
  const skippedPages = pages.filter((p) => p.skipped)
  const regionPages = pages.filter((p) => p.regions?.length > 0)
  const activeCount = detection ? activeRegionCount(detection, excluded) : 0
  const totalCount = detection?.total_regions ?? 0

  return (
    <section className="mb-8 animate-fade-up">
      <Card glow>
        <CardHeader
          title="Detected floor plans"
          subtitle={
            detecting
              ? 'Running Grounding DINO on your document…'
              : detection
                ? `${activeCount} of ${totalCount} clipping${totalCount !== 1 ? 's' : ''} selected · remove dimension tables before analyzing`
                : ''
          }
          badge={
            detecting ? (
              <Badge variant="accent" dot>Detecting</Badge>
            ) : detection?.scenario ? (
              <Badge variant="accent">{scenarioLabel(detection.scenario)}</Badge>
            ) : null
          }
          action={
            file && !detecting ? (
              <Button variant="ghost" size="sm" onClick={onChangeFile}>
                Change file
              </Button>
            ) : null
          }
        />

        <CardBody className="space-y-6">
          {!modelAvailable && !detecting && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200/90">
              Grounding DINO unavailable
              {modelError ? ` (${modelError})` : ''}. Using full-page fallback per sheet.
            </div>
          )}

          {!detecting && activeCount === 0 && totalCount > 0 && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs text-amber-200/90">
              All clippings are excluded. Click + on a floor plan to include it, or upload a different file.
            </div>
          )}

          {regionPages.map((page) => (
            <div key={page.page_number}>
              <p className="text-xs font-semibold text-muted mb-3 uppercase tracking-wider">
                Page {page.page_number}
                {page.regions.length > 1 && (
                  <span className="text-accent ml-2 normal-case">
                    {page.regions.length} detections
                  </span>
                )}
              </p>
              <div
                className={`grid gap-3 ${
                  page.regions.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'max-w-xs'
                }`}
              >
                {page.regions.map((region) => (
                  <RegionThumb
                    key={region.region_id}
                    region={region}
                    excluded={excluded.has(region.region_id)}
                    onToggle={onToggleRegion}
                  />
                ))}
              </div>
            </div>
          ))}

          {skippedPages.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-950/15 p-4">
              <p className="text-sm font-semibold text-amber-200/90 mb-2">
                Skipped pages
              </p>
              <ul className="space-y-1">
                {skippedPages.map((p) => (
                  <li key={p.page_number} className="text-xs text-amber-200/70">
                    Page {p.page_number} — {p.skip_reason ?? 'Non-plan sheet'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detecting && (
            <p className="text-sm text-muted text-center py-8 animate-pulse">
              Detecting floor plan regions…
            </p>
          )}

          {!detecting && detection?.total_regions === 0 && (
            <p className="text-sm text-amber-300 text-center py-8">
              No floor plans detected. Try a clearer scan or a different file.
            </p>
          )}
        </CardBody>
      </Card>
    </section>
  )
}
