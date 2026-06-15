import { useEffect, useState } from 'react'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import Badge from '@/components/ui/Badge'

function BuildingIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ground line */}
      <path
        d="M2 18h16"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* building silhouette */}
      <path
        d="M4.5 18V8.2L10 3.5l5.5 4.7V18"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* door */}
      <rect
        x={7.5}
        y={12.5}
        width={5}
        height={5.5}
        rx={0.75}
        stroke="currentColor"
        strokeWidth={1.2}
      />
      {/* left window */}
      <rect
        x={5.5}
        y={9.5}
        width={2.5}
        height={2.5}
        rx={0.5}
        stroke="currentColor"
        strokeWidth={1.1}
      />
      {/* right window */}
      <rect
        x={12}
        y={9.5}
        width={2.5}
        height={2.5}
        rx={0.5}
        stroke="currentColor"
        strokeWidth={1.1}
      />
    </svg>
  );
}

const BACKEND_STATUS = {
  online: { variant: 'live', label: 'Online' },
  offline: { variant: 'danger', label: 'Offline' },
  checking: { variant: 'warning', label: 'Checking…' },
}

function BackendStatusBadge({ status, apiBaseUrl, onRecheck }) {
  const config = BACKEND_STATUS[status] ?? BACKEND_STATUS.checking

  return (
    <button
      type="button"
      onClick={onRecheck}
      title={`API: ${apiBaseUrl} — click to recheck`}
      className="hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 rounded-full"
    >
      <Badge variant={config.variant} dot={status === 'online'}>
        {config.label}
      </Badge>
    </button>
  )
}

export default function Header() {
  const { status, recheck, apiBaseUrl } = useBackendHealth()
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light'
  })

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-accent/20 bg-accent-subtle flex items-center justify-center">
            <BuildingIcon />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight text-text">
                ZeroxAI-Planner
              </h1>
              <Badge>Build91</Badge>
            </div>
            {/* <p className="text-xs text-muted hidden sm:block leading-none mt-0.5">
              Room dimension extraction
            </p> */}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BackendStatusBadge status={status} apiBaseUrl={apiBaseUrl} onRecheck={recheck} />
          <button
            type="button"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            className="w-9 h-9 rounded-lg border border-line bg-surface flex items-center justify-center hover:bg-card active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
