import {
  ANALYZE_MODELS,
  CORRECTION_MODELS,
  DEFAULT_ANALYZE_MODEL_ID,
  DEFAULT_CORRECTION_MODEL_ID,
  getAnalyzeModelById,
  getCorrectionModelById,
} from '@/constants/analyzeModels'

function ModelDropdown({ id, label, hint, options, value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        <p className="text-xs text-muted mt-0.5">{hint}</p>
      </div>

      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="select disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Vision model pickers for the Analyze tab.
 *
 * Pass 1 extracts rooms; pass 2 re-checks low-confidence results. They can run on
 * different models — pass 2 defaults to inheriting pass 1.
 */
export default function ModelSelector({
  value = DEFAULT_ANALYZE_MODEL_ID,
  onChange,
  correctionValue = DEFAULT_CORRECTION_MODEL_ID,
  onCorrectionChange,
  disabled = false,
}) {
  const selected = getAnalyzeModelById(value)
  const correctionSelected = getCorrectionModelById(correctionValue)

  return (
    <div className="rounded-xl border border-line bg-card px-4 py-3 shadow-[var(--shadow-sm)] mb-4 space-y-3">
      <ModelDropdown
        id="analyze-model"
        label="AI model — pass 1"
        hint="Extracts rooms and dimensions."
        options={ANALYZE_MODELS}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
      {selected?.description && (
        <p className="text-xs text-muted leading-snug">{selected.description}</p>
      )}

      {onCorrectionChange && (
        <>
          <div className="border-t border-line" />
          <ModelDropdown
            id="analyze-correction-model"
            label="AI model — pass 2"
            hint="Re-checks low-confidence rooms."
            options={CORRECTION_MODELS}
            value={correctionValue}
            onChange={onCorrectionChange}
            disabled={disabled}
          />
          {correctionSelected?.description && (
            <p className="text-xs text-muted leading-snug">
              {correctionSelected.description}
            </p>
          )}
        </>
      )}
    </div>
  )
}
