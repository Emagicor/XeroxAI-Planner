import { features } from '@/config/features'

const ALL_MODES = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'testSuite', label: 'Test Suite', feature: 'testSuite' },
]

export default function AppModeTabs({ mode, onChange }) {
  const modes = ALL_MODES.filter((m) => !m.feature || features[m.feature])

  if (modes.length <= 1) return null

  return (
    <div className="flex justify-center mb-8">
      <div
        className="inline-flex rounded-lg border border-line bg-surface p-1 shadow-[var(--shadow-sm)]"
        role="tablist"
        aria-label="Application mode"
      >
        {modes.map((m) => {
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(m.id)}
              className={[
                'px-5 py-2 rounded-md text-sm font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                active
                  ? 'bg-accent text-white shadow-sm'
                  : 'text-muted hover:text-text',
              ].join(' ')}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
