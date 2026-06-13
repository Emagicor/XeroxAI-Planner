import { formatTestSuiteModelLabel } from '@/constants/testSuiteModels'
import { formatTokenCount } from '@/utils/testSuite/visionUsage'

function formatRunTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return timestamp
  }
}

function RunList({ runs, selectedRunId, onSelectRun }) {
  if (!runs.length) {
    return (
      <p className="px-4 py-6 text-xs text-muted text-center">
        No saved runs yet. Complete a batch to see history here.
      </p>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-line/40">
      {[...runs].reverse().map((run) => {
        const active = run.runId === selectedRunId
        const passRate =
          run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0
        const modelLabel = formatTestSuiteModelLabel(run)
        return (
          <li key={run.runId}>
            <button
              type="button"
              onClick={() => onSelectRun(run.runId)}
              className={`w-full text-left px-4 py-3 transition-colors hover:bg-surface/60 ${
                active ? 'bg-accent/10 border-l-2 border-l-accent' : 'border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-text truncate">{formatRunTime(run.timestamp)}</p>
                <span
                  className={`text-xs font-mono shrink-0 ${
                    run.failed === 0 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {run.passed}/{run.totalTests}
                </span>
              </div>
              <p className="text-[10px] text-muted font-mono mt-1 truncate" title={run.runId}>
                {modelLabel ? `${modelLabel} · ` : ''}
                {passRate}% pass
                {run.totalTokens != null && (
                  <span className="text-accent/80">
                    {' · '}
                    {formatTokenCount(run.totalTokens)} tok
                  </span>
                )}
              </p>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Collapsible run-history sidebar (ChatGPT / Claude style).
 */
export default function TestSuiteRunHistorySidebar({
  runs,
  selectedRunId,
  loading,
  open,
  onToggle,
  onSelectRun,
}) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <button
          type="button"
          aria-label="Close run history"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 flex flex-col border-r border-line bg-card shadow-[var(--shadow-lg)] transition-transform duration-300 ease-in-out lg:z-30 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="shrink-0 px-4 py-4 border-b border-line bg-surface/80">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-text">Run history</h2>
              <p className="text-[10px] text-muted mt-0.5 font-mono truncate">
                test-suite/test-results/
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="shrink-0 p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface border border-transparent hover:border-line transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-xs text-muted">Loading runs…</p>
        ) : (
          <RunList runs={runs} selectedRunId={selectedRunId} onSelectRun={onSelectRun} />
        )}
      </aside>

      {/* Toggle tab when closed */}
      {!open && (
        <button
          type="button"
          onClick={onToggle}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 pl-1 pr-2 py-3 rounded-r-lg border border-l-0 border-line bg-card text-xs font-medium text-muted hover:text-text hover:bg-surface shadow-[var(--shadow-md)] transition-colors"
          aria-label="Open run history"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">History</span>
        </button>
      )}
    </>
  )
}
