import Button from '@/components/ui/Button'
import { isProduction } from '@/config/features'

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
    (/cannot reach the (backend|analysis service)|start-backend|backend not running|service unavailable/i.test(message) ||
      /failed to fetch/i.test(message))

  const displayTitle =
    title ??
    (isBackendOffline
      ? (isProduction ? 'Service unavailable' : 'Backend not reachable')
      : 'Something went wrong')

  const displayHint =
    hint ??
    (isBackendOffline && !isProduction
      ? 'In a terminal: cd backend2.0 → .\\start-backend.ps1 — then click Retry.'
      : null)

  return (
    <div className="mt-6 p-5 rounded-xl border alert-error">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)] flex items-center justify-center">
          <svg className="w-4 h-4 text-[var(--danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-text">{displayTitle}</p>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed">{message}</p>
          {displayHint && (
            <p className="text-xs text-muted mt-2 font-mono leading-relaxed">{displayHint}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
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
