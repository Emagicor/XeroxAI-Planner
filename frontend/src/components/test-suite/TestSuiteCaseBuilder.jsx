import { useRef } from 'react'
import ExpandableImage from '@/components/ui/ExpandableImage'
import { formatFileSize } from '@/utils/format'

function ReadyBadge({ ready, saving, persisted, dirty }) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-accent/10 text-accent border-accent/25">
        Saving…
      </span>
    )
  }
  if (persisted && dirty) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-amber-500/10 text-amber-200/90 border-amber-500/25">
        Unsaved changes
      </span>
    )
  }
  if (ready && persisted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
        Ready
      </span>
    )
  }
  if (ready) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-sky-500/10 text-sky-200/90 border-sky-500/25">
        Ready (unsaved)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-amber-500/10 text-amber-200/90 border-amber-500/25">
      Incomplete
    </span>
  )
}

function FileSlot({
  label,
  hint,
  accept,
  fileName,
  fileSize,
  preview,
  isPdf,
  error,
  disabled,
  onSelect,
  onClear,
  placeholder,
}) {
  const inputRef = useRef(null)

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-muted mb-1">{label}</p>
      <p className="text-[10px] text-muted mb-2">{hint}</p>

      {!fileName ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="w-full px-4 py-6 rounded-lg border border-dashed border-line bg-surface/40 text-sm text-muted hover:border-accent/40 hover:text-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {placeholder}
        </button>
      ) : (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-line/60 bg-surface/50">
          {preview && !isPdf ? (
            <div className="w-14 h-14 shrink-0">
              <ExpandableImage
                src={preview}
                alt={fileName || 'Floor plan preview'}
                thumbnail
                expandable
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded border border-line bg-surface flex items-center justify-center shrink-0">
              <span className="text-xs font-mono text-accent">
                {isPdf ? 'PDF' : fileName.endsWith('.json') ? 'JSON' : 'IMG'}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text truncate" title={fileName}>
              {fileName}
            </p>
            {fileSize != null && (
              <p className="text-xs text-muted font-mono mt-0.5">
                {formatFileSize(fileSize)}
              </p>
            )}
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="text-xs text-accent hover:underline disabled:opacity-40"
              >
                Replace
              </button>
              {onClear && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClear}
                  className="text-xs text-muted hover:text-red-400 disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onSelect(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function TestCaseRow({
  index,
  testCase,
  loading,
  runnable,
  selected,
  onToggleSelect,
  onInputSelect,
  onGroundTruthSelect,
  onGroundTruthClear,
  onSave,
  onRemove,
}) {
  const isPdf = testCase.inputFile?.name.toLowerCase().endsWith('.pdf')
  const ready =
    Boolean(testCase.inputFile) &&
    Boolean(testCase.groundTruth) &&
    !testCase.gtError
  const showSave =
    ready &&
    !testCase.saving &&
    (!testCase.persisted || testCase.dirty)

  return (
    <div
      className={`rounded-xl border bg-card/60 p-4 transition-colors ${
        runnable && selected ? 'border-accent/40' : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="checkbox"
            checked={selected}
            disabled={!runnable || loading || testCase.saving}
            onChange={() => onToggleSelect(testCase.id)}
            className="w-4 h-4 rounded border-line cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              runnable
                ? selected
                  ? 'Included in batch run'
                  : 'Excluded from batch run'
                : 'Save this case before it can run'
            }
          />
          <span className="text-xs font-mono text-muted">Case #{index + 1}</span>
          {testCase.label && (
            <span className="text-xs text-text">{testCase.label}</span>
          )}
          {testCase.permanent && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border bg-violet-500/10 text-violet-200/90 border-violet-500/25">
              Built-in
            </span>
          )}
          <ReadyBadge
            ready={ready}
            saving={testCase.saving}
            persisted={testCase.persisted}
            dirty={testCase.dirty}
          />
        </div>
        <div className="flex items-center gap-3">
          {showSave && (
            <button
              type="button"
              disabled={loading || testCase.saving}
              onClick={onSave}
              className="text-sm px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-40 font-medium"
            >
              {testCase.persisted ? 'Save changes' : 'Save to suite'}
            </button>
          )}
          <button
            type="button"
            disabled={loading || testCase.saving}
            onClick={onRemove}
            className="text-sm px-3 py-2 text-muted hover:text-red-400 disabled:opacity-40"
          >
            Delete case
          </button>
        </div>
      </div>

      {testCase.saveError && (
        <p className="mb-3 text-xs text-red-400">{testCase.saveError}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FileSlot
          label="Floor plan"
          hint="JPG, PNG, or PDF"
          accept=".jpg,.jpeg,.png,.pdf"
          fileName={testCase.inputFile?.name}
          fileSize={testCase.inputFile?.size}
          preview={testCase.preview}
          isPdf={isPdf}
          disabled={loading || testCase.saving}
          onSelect={onInputSelect}
          placeholder="Click to upload floor plan"
        />

        <FileSlot
          label="Ground truth JSON"
          hint="Expected rooms & dimensions for this plan"
          accept=".json,application/json"
          fileName={testCase.groundTruth?.fileName}
          error={testCase.gtError}
          disabled={loading || testCase.saving}
          onSelect={onGroundTruthSelect}
          onClear={onGroundTruthClear}
          placeholder="Click to upload ground truth"
        />
      </div>
    </div>
  )
}

export default function TestSuiteCaseBuilder({
  cases,
  casesLoading,
  casesLoadError,
  loading,
  readyCount,
  bulkInputRef,
  onAddEmptyCase,
  onAddInputFiles,
  onBulkDrop,
  onCaseInputSelect,
  onCaseGroundTruthSelect,
  onCaseGroundTruthClear,
  onSaveCase,
  onRemoveCase,
  onReloadCases,
  hideAddButton = false,
  isCaseSelected,
  onToggleCaseSelection,
  canRunCase,
}) {
  const browseBulk = () => bulkInputRef.current?.click()

  if (casesLoading) {
    return (
      <div className="rounded-xl border border-line bg-card/85 p-10 text-center">
        <p className="text-sm text-muted">Loading saved test cases…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {casesLoadError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-300">{casesLoadError}</p>
          {onReloadCases && (
            <button
              type="button"
              onClick={onReloadCases}
              className="text-xs text-red-200 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
        <p className="text-xs text-[#C8C6BE]">
          <span className="text-text">Save to suite</span> creates{' '}
          <span className="font-mono">{'test-suite/cases/{id}/'}</span> and adds an entry to{' '}
          <span className="font-mono">manifest.json</span>. Saved cases preload on the next visit.
        </p>
      </div>

      {cases.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed border-line bg-card/85 p-10 text-center hover:border-accent/40 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onBulkDrop}
        >
          <p className="text-lg font-medium text-text mb-1">
            Build your test suite
          </p>
          <p className="text-sm text-muted mb-6 max-w-md mx-auto">
            No saved cases yet. Add a test case, attach floor plan + ground truth, then click{' '}
            <span className="text-text">Save to suite</span> to persist it.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onAddEmptyCase}
              className="px-6 py-3 rounded-xl border border-line bg-surface text-base font-medium text-text hover:border-accent/50"
            >
              Add test case
            </button>
            <button
              type="button"
              onClick={browseBulk}
              className="px-6 py-3 rounded-xl bg-accent text-white text-base font-medium hover:bg-accent/90"
            >
              Add multiple floor plans
            </button>
            <a
              href="/samples/ground-truth.example.json"
              download
              className="px-6 py-3 rounded-xl text-base text-accent hover:underline"
            >
              Example GT format
            </a>
          </div>
        </div>
      ) : (
        <>
          {!hideAddButton && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
              <p className="text-sm text-muted">
                <span className="text-text font-medium">{readyCount}</span> saved &amp; ready
                {cases.length !== readyCount && (
                  <>
                    {' '}
                    · <span className="text-text font-medium">{cases.length}</span> total
                  </>
                )}
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={onAddEmptyCase}
                className="px-5 py-2.5 rounded-xl border border-line bg-surface text-sm font-medium text-text hover:border-accent/50 disabled:opacity-40"
              >
                + Add test case
              </button>
            </div>
          )}

          <div className="space-y-3">
            {cases.map((testCase, i) => (
              <TestCaseRow
                key={testCase.id}
                index={i}
                testCase={testCase}
                loading={loading}
                runnable={canRunCase?.(testCase) ?? false}
                selected={isCaseSelected?.(testCase.id) ?? false}
                onToggleSelect={onToggleCaseSelection}
                onInputSelect={(file) => onCaseInputSelect(testCase.id, file)}
                onGroundTruthSelect={(file) =>
                  onCaseGroundTruthSelect(testCase.id, file)
                }
                onGroundTruthClear={() => onCaseGroundTruthClear(testCase.id)}
                onSave={() => onSaveCase(testCase.id)}
                onRemove={() => onRemoveCase(testCase.id)}
              />
            ))}
          </div>
        </>
      )}

      <input
        ref={bulkInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          onAddInputFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
