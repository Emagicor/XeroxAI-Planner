import { useToastStore } from '@/stores/toastStore'

const STYLES = {
  error: { wrapper: 'toast-error', icon: 'text-[var(--danger)]' },
  warning: { wrapper: 'toast-warning', icon: 'text-[var(--warning)]' },
  success: { wrapper: 'toast-success', icon: 'text-[var(--success)]' },
  info: { wrapper: 'toast-info', icon: 'text-[var(--info)]' },
}

function ToastIcon({ type }) {
  if (type === 'success') {
    return (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (type === 'error') {
    return (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (type === 'warning') {
    return (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  }
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (!toasts.length) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0 pointer-events-none"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => {
        const style = STYLES[t.type] ?? STYLES.info
        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto rounded-lg border p-4 flex gap-3 shadow-[var(--shadow-lg)] animate-[toast-in_0.2s_ease-out] ${style.wrapper}`}
          >
            <div className={style.icon}>
              <ToastIcon type={t.type} />
            </div>
            <div className="min-w-0 flex-1">
              {t.title && (
                <p className="text-sm font-semibold text-text">{t.title}</p>
              )}
              <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-muted hover:text-text p-1 -m-1 rounded transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
