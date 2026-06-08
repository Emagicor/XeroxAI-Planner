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

export default function TestSuiteRunHistory({
  runs,
  selectedRunId,
  loading,
  onSelectRun,
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-card/60 px-4 py-3">
        <p className="text-xs text-muted">Loading run history…</p>
      </div>
    )
  }

  if (!runs.length) return null

  return (
    <section className="rounded-xl border border-line bg-card/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-line/60 bg-surface/30">
        <h3 className="text-sm font-medium text-text">Run history</h3>
        <p className="text-xs text-muted mt-0.5">
          Past batch runs are saved under{' '}
          <span className="font-mono">test-suite/test-results/</span>
        </p>
      </div>

      <ul className="max-h-56 overflow-y-auto divide-y divide-line/40">
        {[...runs].reverse().map((run) => {
          const active = run.runId === selectedRunId
          const passRate =
            run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0
          return (
            <li key={run.runId}>
              <button
                type="button"
                onClick={() => onSelectRun(run.runId)}
                className={`w-full text-left px-4 py-3 transition-colors hover:bg-surface/40 ${
                  active ? 'bg-accent/10 border-l-2 border-l-accent' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-text">{formatRunTime(run.timestamp)}</p>
                  <span
                    className={`text-xs font-mono shrink-0 ${
                      run.failed === 0 ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {run.passed}/{run.totalTests} passed
                  </span>
                </div>
                <p className="text-[10px] text-muted font-mono mt-1 truncate" title={run.runId}>
                  {run.runId} · {passRate}% pass rate
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
