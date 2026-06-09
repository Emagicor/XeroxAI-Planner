import { useEffect, useMemo, useState } from 'react'
import AnnotatedImagePanel from './AnnotatedImagePanel'
import { inlineImageSrc, resolveAnnotatedSrc } from '@/utils/annotatedImage'
import { pageTypeLabel } from '@/utils/pageTypes'

export default function AnnotatedPagesPanel({
  jobId,
  annotatedPages,
  pageSummaries,
  defaultPage,
  activePage,
  activeRoom,
  legendRooms,
  onPageChange,
  onSelectRoom,
}) {
  const tabs = useMemo(() => {
    if (pageSummaries?.length) {
      return pageSummaries.map((p) => ({
        page: p.page,
        eligible: p.eligible,
        pageType: p.pageType,
        floorLabel: p.floorLabel,
        hasAnnotated: annotatedPages?.some(
          (a) =>
            a.page === p.page &&
            (a.hasAnnotated || a.annotatedImage || a.clipPreview),
        ),
      }))
    }
    return (annotatedPages ?? [])
      .filter((p) => p.hasAnnotated || p.annotatedImage)
      .map((p) => ({
        page: p.page,
        eligible: p.eligible !== false,
        pageType: 'floorplan',
        hasAnnotated: true,
      }))
  }, [pageSummaries, annotatedPages])

  const eligible = useMemo(
    () =>
      (annotatedPages ?? []).filter(
        (p) => p.hasAnnotated || p.annotatedImage || p.clipPreview,
      ),
    [annotatedPages],
  )

  const [selectedPage, setSelectedPage] = useState(
    activePage ?? defaultPage ?? tabs.find((t) => t.eligible)?.page ?? tabs[0]?.page ?? 1,
  )

  useEffect(() => {
    if (activePage != null) setSelectedPage(activePage)
  }, [activePage])

  const currentTab = tabs.find((t) => t.page === selectedPage) ?? tabs[0]
  const current = eligible.find((p) => p.page === selectedPage) ?? eligible[0]

  if (!tabs.length) {
    return (
      <div className="lg:w-[58%] rounded-xl border border-line bg-card/50 p-8 text-center text-muted text-sm">
        No pages in this document.
      </div>
    )
  }

  const handlePage = (page) => {
    setSelectedPage(page)
    onPageChange?.(page)
  }

  if (!currentTab?.eligible || !current) {
    return (
      <div className="lg:w-[58%]">
        {tabs.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tabs.map((t) => (
              <button
                key={t.page}
                type="button"
                onClick={() => handlePage(t.page)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedPage === t.page
                    ? 'border-accent bg-accent/15 text-text'
                    : t.eligible
                      ? 'border-line text-muted hover:border-accent/40'
                      : 'border-line/60 text-muted/70 hover:border-amber-500/30'
                }`}
              >
                {t.floorLabel ?? `Page ${t.page}`}
                {!t.eligible && (
                  <span className="ml-1 opacity-70">· skipped</span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="rounded-xl border border-line bg-card/50 p-8 text-center">
          <p className="text-sm font-medium text-text mb-1">
            Page {selectedPage} — {pageTypeLabel(currentTab?.pageType)}
          </p>
          <p className="text-xs text-muted">
            This page was skipped because it is not a floor plan layout (e.g. cover sheet,
            notes, or schedule). Select an analyzed page to view annotations.
          </p>
        </div>
      </div>
    )
  }

  const imageSrc =
    resolveAnnotatedSrc({
      jobId,
      page: current.page,
      inlineBase64: current.annotatedImage,
      hasAnnotated: current.hasAnnotated,
    }) ??
    (current.clipPreview ? inlineImageSrc(current.clipPreview) : null)

  return (
    <div className="lg:w-[58%]">
      {tabs.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tabs.map((t) => (
            <button
              key={t.page}
              type="button"
              onClick={() => handlePage(t.page)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedPage === t.page
                  ? 'border-accent bg-accent/15 text-text'
                  : t.eligible
                    ? 'border-line text-muted hover:border-accent/40'
                    : 'border-line/60 text-muted/70 hover:border-amber-500/30'
              }`}
            >
              {t.floorLabel ?? `Page ${t.page}`}
              {!t.eligible && <span className="ml-1 opacity-70">· skipped</span>}
            </button>
          ))}
        </div>
      )}

      <AnnotatedImagePanel
        imageSrc={imageSrc}
        inlineBase64={current.annotatedImage}
        rooms={legendRooms ?? current.rooms}
        activeRoom={activeRoom}
        onSelectRoom={onSelectRoom}
      />
    </div>
  )
}
