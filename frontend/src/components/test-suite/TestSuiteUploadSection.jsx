import ErrorBanner from '@/components/ui/ErrorBanner'
import Button from '@/components/ui/Button'
import TestSuiteCaseBuilder from './TestSuiteCaseBuilder'

function RunStatusHint({ unsavedCount, readyCount }) {
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
  return <p className="text-sm text-emerald-400/90">All saved cases ready to run</p>
}

export default function TestSuiteUploadSection({
  cases,
  casesLoading,
  casesLoadError,
  loading,
  readyCount,
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
}) {
  const showToolbar = cases.length > 0 && !loading && !casesLoading

  return (
    <section className="space-y-6">
      {showToolbar && (
        <div className="sticky top-4 z-20 rounded-2xl border border-line bg-card/95 backdrop-blur-md shadow-xl shadow-black/25 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-base font-medium text-text">Test suite</p>
              <p className="text-sm text-muted mt-0.5">
                <span className="text-text font-semibold">{readyCount}</span> ready
                <span className="mx-2 text-line">·</span>
                <span className="text-text font-semibold">{cases.length}</span> total cases
              </p>
              <div className="mt-2">
                <RunStatusHint unsavedCount={unsavedCount} readyCount={readyCount} />
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
                Run {readyCount || 0} test case{readyCount !== 1 ? 's' : ''}
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
      />

      {error && <ErrorBanner message={error} onRetry={onRetry} />}
    </section>
  )
}
