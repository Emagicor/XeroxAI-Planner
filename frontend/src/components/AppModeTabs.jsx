const MODES = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'testSuite', label: 'Test Suite' },
]

export default function AppModeTabs({ mode, onChange }) {
  return (
    <div className="flex justify-center mb-8">
      <div
        className="inline-flex rounded-xl border border-line bg-card/80 p-1 backdrop-blur-sm"
        role="tablist"
        aria-label="Application mode"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => onChange(m.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m.id
                ? 'bg-accent text-white shadow-md shadow-accent/25'
                : 'text-[#8B8A82] hover:text-[#F0EEE8]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}
