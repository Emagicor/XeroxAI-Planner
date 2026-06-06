import { useEffect, useState } from 'react'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import Badge from '@/components/ui/Badge'
//Navbar
function BuildingIcon() {
  return (
    <svg
      className="w-6 h-6 text-accent"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.7}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21h18M5 21V9l7-6 7 6v12M9 21v-6h6v6"
      />
    </svg>
  )
}

const BACKEND_STATUS = {
  online: { variant: 'live', label: 'Backend online' },
  offline: { variant: 'danger', label: 'Backend offline' },
  checking: { variant: 'warning', label: 'Checking…' },
}

function BackendStatusBadge({ status, apiBaseUrl, onRecheck }) {
  const config = BACKEND_STATUS[status] ?? BACKEND_STATUS.checking

  return (
    <button
      type="button"
      onClick={onRecheck}
      title={`API: ${apiBaseUrl} — click to recheck`}
      className="hover:opacity-80 transition-opacity"
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
    <header className="sticky top-0 z-50 border-b border-line/60 bg-bg/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl border border-accent/25 bg-accent/10 flex items-center justify-center shadow-lg shadow-accent/10">
              <BuildingIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-text">
                  FloorPlan AI
                </h1>
                <Badge>Build91</Badge>
              </div>
              <p className="text-xs text-muted mt-0.5 hidden sm:block">
                Room dimension extraction &amp; evaluation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <BackendStatusBadge status={status} apiBaseUrl={apiBaseUrl} onRecheck={recheck} />
            <button
              type="button"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="w-10 h-10 rounded-xl border border-line bg-card/60 flex items-center justify-center hover:bg-text/5 active:scale-95 transition-all cursor-pointer shadow-sm"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
