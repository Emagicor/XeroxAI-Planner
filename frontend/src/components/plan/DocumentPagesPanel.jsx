import { pageTypeLabel } from '@/utils/pageTypes'
import Badge from '@/components/ui/Badge'

function PageBadge({ eligible, pageType }) {
  if (eligible) {
    return <Badge variant="success">Analyzed</Badge>
  }
  return (
    <Badge variant="warning">
      Skipped · {pageTypeLabel(pageType)}
    </Badge>
  )
}

export default function DocumentPagesPanel({ pageSummaries, activePage, onSelectPage, scenario }) {
  if (!pageSummaries?.length) return null

  const eligibleCount = pageSummaries.filter((p) => p.eligible).length
  const skippedCount = pageSummaries.length - eligibleCount
  const multiRegion = pageSummaries.some((p) => (p.regionIndex ?? 1) > 1)

  return (
    <div className="mb-6 rounded-xl border border-line bg-card overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="px-4 py-3 border-b border-line bg-surface flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text">
            {multiRegion ? 'Floor plans' : 'Document pages'}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {pageSummaries.length} plan{pageSummaries.length !== 1 ? 's' : ''} ·{' '}
            {eligibleCount} analyzed
            {skippedCount > 0 && ` · ${skippedCount} skipped`}
          </p>
        </div>
        {scenario && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-line text-muted">
            {scenario.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <ul className="divide-y divide-line/40">
        {pageSummaries.map((p) => {
          const active = activePage === p.page
          return (
            <li key={p.page}>
              <button
                type="button"
                onClick={() => onSelectPage?.(p.page)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  active ? 'bg-accent/10' : 'hover:bg-surface/30'
                } ${p.eligible ? '' : 'opacity-80'}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs ${
                    active
                      ? 'border-accent/50 bg-accent/15 text-accent'
                      : 'border-line bg-surface text-muted'
                  }`}
                >
                  {p.page}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-text">
                      {p.floorLabel ?? `Page ${p.page}`}
                    </span>
                    <PageBadge eligible={p.eligible} pageType={p.pageType} />
                  </div>
                  {!p.eligible && p.reason && (
                    <p className="text-xs text-muted mt-0.5 truncate" title={p.reason}>
                      {p.reason}
                    </p>
                  )}
                  {p.eligible && (
                    <p className="text-xs text-muted mt-0.5">
                      {p.roomCount} room{p.roomCount !== 1 ? 's' : ''}
                      {p.totalAreaSqft > 0 && (
                        <span className="font-mono ml-2">{p.totalAreaSqft.toFixed(0)} sq ft</span>
                      )}
                    </p>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
