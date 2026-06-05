import { pageTypeLabel } from '../utils/pageTypes'

function PageBadge({ eligible, pageType }) {
  if (eligible) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
        Analyzed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-500/10 text-amber-200/90 border-amber-500/25">
      Skipped · {pageTypeLabel(pageType)}
    </span>
  )
}

export default function DocumentPagesPanel({ pageSummaries, activePage, onSelectPage }) {
  if (!pageSummaries?.length) return null

  const eligibleCount = pageSummaries.filter((p) => p.eligible).length
  const skippedCount = pageSummaries.length - eligibleCount

  return (
    <div className="mb-6 rounded-xl border border-line bg-card/70 overflow-hidden">
      <div className="px-4 py-3 border-b border-line/60 bg-surface/20 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#F0EEE8]">Document pages</p>
          <p className="text-xs text-[#8B8A82] mt-0.5">
            {pageSummaries.length} page{pageSummaries.length !== 1 ? 's' : ''} ·{' '}
            {eligibleCount} floor plan{eligibleCount !== 1 ? 's' : ''} analyzed
            {skippedCount > 0 && ` · ${skippedCount} non-plan page${skippedCount !== 1 ? 's' : ''} skipped`}
          </p>
        </div>
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
                      : 'border-line bg-surface text-[#8B8A82]'
                  }`}
                >
                  {p.page}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[#F0EEE8]">Page {p.page}</span>
                    <PageBadge eligible={p.eligible} pageType={p.pageType} />
                  </div>
                  {!p.eligible && p.reason && (
                    <p className="text-xs text-[#8B8A82] mt-0.5 truncate" title={p.reason}>
                      {p.reason}
                    </p>
                  )}
                  {p.eligible && (
                    <p className="text-xs text-[#8B8A82] mt-0.5">
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
