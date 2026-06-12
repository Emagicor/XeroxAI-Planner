import ErrorBanner from '@/components/ui/ErrorBanner'
import Button from '@/components/ui/Button'
import TestSuiteCaseBuilder from './TestSuiteCaseBuilder'
import TestSuiteModelSelector from './TestSuiteModelSelector'

function RunStatusHint({ unsavedCount, readyCount, selectedCount }) {
  if (unsavedCount > 0) {
    return (
      <p className="text-sm text-amber-300/90">
        {unsavedCount} case{unsavedCount !== 1 ? 's' : ''} need saving before they can run.
      </p>
    )
  }
  if (readyCount === 0) {
    return (
      <p className="text-sm text-amber-300/90">
        Add and save at least one case to run the batch.
      </p>
    )
  }
  if (selectedCount === 0) {
    return (
      <p className="text-sm text-amber-300/90">
        Select at least one case to run.
      </p>
    )
  }
  if (selectedCount < readyCount) {
    return (
      <p className="text-sm text-emerald-400/90">
        {selectedCount} of {readyCount} ready case{readyCount !== 1 ? 's' : ''} selected
      </p>
    )
  }
  return <p className="text-sm text-emerald-400/90">All saved cases selected</p>
}

export default function TestSuiteUploadSection({
  cases,
  casesLoading,
  casesLoadError,
  loading,
  readyCount,
  selectedCount,
  error,
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
  canRun,
  unsavedCount,
  onRun,
  onRetry,
  selectedModelId,
  onModelChange,
  isCaseSelected,
  onToggleCaseSelection,
  onSelectAll,
  onDeselectAll,
  canRunCase,
}) {
  const showToolbar = cases.length > 0 && !loading && !casesLoading

  return (
    <section className="space-y-6">
      <TestSuiteModelSelector
        value={selectedModelId}
        onChange={onModelChange}
        disabled={loading}
      />

      {showToolbar && (
        <div className="sticky top-4 z-20 rounded-xl border border-line bg-card shadow-[var(--shadow-md)] p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-medium text-text">Test suite</p>
              <p className="text-sm text-muted mt-0.5">
                <span className="text-text font-semibold">{selectedCount}</span> selected
                <span className="mx-2 text-line">·</span>
                <span className="text-text font-semibold">{readyCount}</span> ready
                <span className="mx-2 text-line">·</span>
                <span className="text-text font-semibold">{cases.length}</span> total
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <RunStatusHint
                  unsavedCount={unsavedCount}
                  readyCount={readyCount}
                  selectedCount={selectedCount}
                />
                {readyCount > 0 && (
                  <>
                    <span className="text-line hidden sm:inline">·</span>
                    <button
                      type="button"
                      disabled={loading || selectedCount === readyCount}
                      onClick={onSelectAll}
                      className="text-xs text-accent hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      disabled={loading || selectedCount === 0}
                      onClick={onDeselectAll}
                      className="text-xs text-muted hover:text-text disabled:opacity-40"
                    >
                      Clear selection
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap gap-3 shrink-0">
              <Button
                variant="secondary"
                size="lg"
                disabled={loading}
                onClick={onAddEmptyCase}
                className="min-w-[10.5rem]"
              >
                + Add test case
              </Button>
              <Button size="lg" disabled={!canRun} onClick={onRun} className="min-w-[12rem]">
                Run {selectedCount || 0} test case{selectedCount !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TestSuiteCaseBuilder
        cases={cases}
        casesLoading={casesLoading}
        casesLoadError={casesLoadError}
        loading={loading}
        readyCount={readyCount}
        bulkInputRef={bulkInputRef}
        onAddEmptyCase={onAddEmptyCase}
        onAddInputFiles={onAddInputFiles}
        onBulkDrop={onBulkDrop}
        onCaseInputSelect={onCaseInputSelect}
        onCaseGroundTruthSelect={onCaseGroundTruthSelect}
        onCaseGroundTruthClear={onCaseGroundTruthClear}
        onSaveCase={onSaveCase}
        onRemoveCase={onRemoveCase}
        onReloadCases={onReloadCases}
        hideAddButton={showToolbar}
        isCaseSelected={isCaseSelected}
        onToggleCaseSelection={onToggleCaseSelection}
        canRunCase={canRunCase}
      />

      {error && <ErrorBanner message={error} onRetry={onRetry} />}
    </section>
  )
}
