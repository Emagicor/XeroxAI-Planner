import Button from '@/components/ui/Button'

export default function ErrorBanner({
  message,
  title,
  onRetry,
  retryLabel = 'Retry',
  onDismiss,
  hint,
}) {
  const isBackendOffline =
    typeof message === 'string' &&
    (/cannot reach the backend|start-backend|backend not running/i.test(message) ||
      /failed to fetch/i.test(message))

  const displayTitle =
    title ?? (isBackendOffline ? 'Backend not reachable' : 'Something went wrong')

  const displayHint =
    hint ??
    (isBackendOffline
      ? 'In a terminal: cd backend2.0 → .\\start-backend.ps1 — then click Retry.'
      : null)

  return (
    <div className="mt-6 p-5 rounded-2xl border border-red-500/30 bg-red-950/30 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-red-200">{displayTitle}</p>
          <p className="text-sm text-red-300/80 mt-1 leading-relaxed">{message}</p>
          {displayHint && (
            <p className="text-xs text-red-300/60 mt-2 font-mono leading-relaxed">{displayHint}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-4">
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
        {onDismiss && (
          <Button variant="secondary" size="sm" onClick={onDismiss}>
            Choose another file
          </Button>
        )}
      </div>
    </div>
  )
}
