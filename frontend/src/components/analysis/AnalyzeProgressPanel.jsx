import { inlineImageSrc } from '@/utils/inlineImage'
import LoadingIndicator from '@/components/ui/LoadingIndicator'
import Card, { CardBody } from '@/components/ui/Card'
import SectionHeader from '@/components/ui/SectionHeader'
import Badge from '@/components/ui/Badge'
// progress status in analyze tab
function StatusIcon({ status }) {
  if (status === 'running') {
    return (
      <span className="relative flex h-5 w-5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/40 opacity-60" />
        <span className="relative inline-flex h-5 w-5 rounded-full bg-accent/20 border border-accent/50 items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-accent" />
        </span>
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15 border border-red-500/40 text-red-400">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-surface/80">
      <span className="h-1.5 w-1.5 rounded-full bg-muted/50" />
    </span>
  )
}
// Main Progress Panel after the clipped images are being processed for floor evaluation
export default function AnalyzeProgressPanel({
  items,
  currentIndex,
  loadingStep,
  loadingSteps,
  totalRegions,
}) {
  const completed = items.filter((i) => i.status === 'done' || i.status === 'error').length
  const pct = totalRegions > 0 ? Math.round((completed / totalRegions) * 100) : 0

  return (
    <section className="mb-8 max-w-3xl mx-auto animate-fade-up">
      <SectionHeader
        eyebrow="Processing"
        title="Analyzing floor plans"
        subtitle={`Vision model extracting room dimensions from ${totalRegions} plan${totalRegions !== 1 ? 's' : ''}.`}
        action={<Badge variant="accent" dot>Live</Badge>}
      />

      <Card glow>
        <div className="px-5 py-4 border-b border-line/60">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-text font-medium">Progress</span>
            <span className="font-mono text-accent font-semibold">
              {completed} / {totalRegions}
            </span>
          </div>
          <div className="h-2 rounded-full bg-line/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 shadow-sm shadow-accent/40"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <CardBody className="p-0">
          <ul className="divide-y divide-line/40">
            {items.map((item, i) => {
              const active = currentIndex === i && item.status === 'running'
              const thumb = item.clipPreview ? inlineImageSrc(item.clipPreview) : null
              return (
                <li
                  key={item.id}
                  className={`px-5 py-3 flex items-center gap-3 ${active ? 'bg-accent/5' : ''}`}
                >
                  <StatusIcon status={item.status} />
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="w-20 h-20 object-contain rounded-lg border border-line bg-white shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-line bg-surface shrink-0 flex items-center justify-center text-xs text-accent font-mono font-medium">
                      {item.planNumber}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{item.label}</p>
                    {item.message && (
                      <p className="text-xs text-muted mt-0.5 truncate">{item.message}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>

      <LoadingIndicator
        steps={loadingSteps}
        currentStep={loadingStep}
        label={
          currentIndex >= 0
            ? `Analyzing plan ${currentIndex + 1} of ${totalRegions}…`
            : 'Finalizing…'
        }
      />
    </section>
  )
}
