import { useEffect, useMemo, useState } from 'react'
import AnnotatedImagePanel from './AnnotatedImagePanel'
import { resolveAnnotatedSrc } from '../utils/annotatedImage'

export default function AnnotatedPagesPanel({
  jobId,
  annotatedPages,
  defaultPage,
  activePage,
  activeRoom,
  legendRooms,
  onPageChange,
  onSelectRoom,
}) {
  const eligible = useMemo(
    () => (annotatedPages ?? []).filter((p) => p.hasAnnotated || p.annotatedImage),
    [annotatedPages],
  )

  const [selectedPage, setSelectedPage] = useState(
    activePage ?? defaultPage ?? eligible[0]?.page ?? 1,
  )

  useEffect(() => {
    if (activePage != null) setSelectedPage(activePage)
  }, [activePage])

  const current = eligible.find((p) => p.page === selectedPage) ?? eligible[0]

  if (!eligible.length) {
    return (
      <div className="lg:w-[58%] rounded-xl border border-line bg-card/50 p-8 text-center text-[#8B8A82] text-sm">
        No annotated preview for this document. Check the API logs or re-run analysis.
      </div>
    )
  }

  const imageSrc = resolveAnnotatedSrc({
    jobId,
    page: current.page,
    inlineBase64: current.annotatedImage,
    hasAnnotated: current.hasAnnotated,
  })

  const handlePage = (page) => {
    setSelectedPage(page)
    onPageChange?.(page)
  }

  return (
    <div className="lg:w-[58%]">
      {eligible.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {eligible.map((p) => (
            <button
              key={p.page}
              type="button"
              onClick={() => handlePage(p.page)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedPage === p.page
                  ? 'border-accent bg-accent/15 text-[#F0EEE8]'
                  : 'border-line text-[#8B8A82] hover:border-accent/40'
              }`}
            >
              Page {p.page}
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
