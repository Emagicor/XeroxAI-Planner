const MODES = [
  { id: 'analyze', label: 'Analyze', description: 'Extract room dimensions' },
  { id: 'testSuite', label: 'Test Suite', description: 'Batch QA against ground truth' },
]
// Component to switch between modes (Analyze and Test-Suite)
export default function AppModeTabs({ mode, onChange }) {
  return (
    <div className="flex justify-center mb-10">
      <div
        className="inline-flex rounded-2xl border border-line/80 bg-card/60 p-1.5 backdrop-blur-sm shadow-lg shadow-black/10"
        role="tablist"
        aria-label="Application mode"
      >
        {MODES.map((m) => {
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(m.id)}
              className={[
                'px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                active
                  ? 'bg-accent text-white shadow-md shadow-accent/30'
                  : 'text-muted hover:text-text hover:bg-text/5',
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
