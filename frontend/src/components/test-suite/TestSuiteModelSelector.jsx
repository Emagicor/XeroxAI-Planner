import {
  DEFAULT_TEST_SUITE_MODEL_ID,
  TEST_SUITE_MODELS,
} from '@/constants/testSuiteModels'

export default function TestSuiteModelSelector({
  value = DEFAULT_TEST_SUITE_MODEL_ID,
  onChange,
  disabled = false,
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 shadow-[var(--shadow-sm)]">
      <p className="text-sm font-medium text-text">Vision model</p>
      <p className="text-xs text-muted mt-0.5 mb-3">
        Server default uses the same analyze pipeline as the Analyze tab.
        Other options override the vision provider for benchmark runs only.
      </p>

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        {TEST_SUITE_MODELS.map((option) => {
          const active = value === option.id
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(option.id)}
              className={`text-left rounded-lg border px-3 py-2.5 min-w-[10.5rem] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${
                active
                  ? 'border-accent bg-accent-subtle text-text'
                  : 'border-line bg-surface text-muted hover:border-accent/30 hover:text-text'
              }`}
            >
              <p className="text-sm font-medium">{option.label}</p>
              <p
                className="text-xs font-mono text-muted mt-0.5 truncate"
                title={option.model ?? option.description}
              >
                {option.model ?? 'backend .env default'}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
