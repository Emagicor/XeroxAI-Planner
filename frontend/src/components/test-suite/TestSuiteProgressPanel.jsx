import ExpandableImage from '@/components/ui/ExpandableImage'
import LoadingIndicator from '@/components/ui/LoadingIndicator'

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
  if (status === 'warning') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
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

function statusLabel(status) {
  const map = {
    pending: 'Queued',
    running: 'Processing',
    done: 'Complete',
    warning: 'Eval issue',
    error: 'Failed',
  }
  return map[status] ?? status
}

function statusTone(status) {
  const map = {
    pending: 'text-muted',
    running: 'text-accent',
    done: 'text-emerald-400',
    warning: 'text-amber-300',
    error: 'text-red-400',
  }
  return map[status] ?? 'text-muted'
}

export default function TestSuiteProgressPanel({
  runProgress,
  currentIndex,
  loadingStep,
  loadingSteps,
  totalCases,
}) {
  const completedCount = runProgress.filter(
    (item) => item.status === 'done' || item.status === 'warning' || item.status === 'error',
  ).length
  const progressPct = totalCases > 0 ? Math.round((completedCount / totalCases) * 100) : 0

  return (
    <section className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-xl font-medium text-text">Running test suite</h2>
        <p className="text-sm text-muted mt-2">
          Processing {totalCases} test case{totalCases !== 1 ? 's' : ''} sequentially.
          Results will appear when the full batch completes.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-card overflow-hidden shadow-[var(--shadow-md)]">
        <div className="px-6 py-5 border-b border-line bg-surface">
          <div className="flex items-center justify-between gap-4 mb-3">
            <p className="text-sm font-medium text-text">Batch progress</p>
            <p className="text-sm font-mono text-accent">
              {completedCount} / {totalCases}
            </p>
          </div>
          <div className="h-2 rounded-full bg-line/80 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent/80 to-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2">{progressPct}% complete</p>
        </div>

        <ul className="divide-y divide-line/50">
          {runProgress.map((item, i) => {
            const isPdf = item.inputFileName?.toLowerCase().endsWith('.pdf')
            const active = currentIndex === i && item.status === 'running'
            return (
              <li
                key={item.caseId}
                className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                  active ? 'bg-accent/5' : ''
                }`}
              >
                <StatusIcon status={item.status} />
                {item.preview && !isPdf ? (
                  <div className="w-11 h-11 shrink-0">
                    <ExpandableImage
                      src={item.preview}
                      alt={item.inputFileName || 'Floor plan preview'}
                      thumbnail
                      expandable
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-lg border border-line bg-surface flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-mono text-accent">
                      {isPdf ? 'PDF' : 'IMG'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-muted">Case {i + 1}</span>
                    <span className={`text-xs font-medium ${statusTone(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <p className="text-sm text-text truncate mt-0.5" title={item.inputFileName}>
                    {item.inputFileName}
                  </p>
                  <p className="text-xs text-muted truncate" title={item.groundTruthFileName}>
                    GT: {item.groundTruthFileName}
                  </p>
                  {item.message && item.status !== 'pending' && (
                    <p className={`text-xs mt-1 ${statusTone(item.status)}`}>
                      {item.message}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <LoadingIndicator
        steps={loadingSteps}
        currentStep={loadingStep}
        label={
          currentIndex >= 0
            ? `Analyzing case ${currentIndex + 1} of ${totalCases}…`
            : 'Finalizing results…'
        }
      />
    </section>
  )
}
