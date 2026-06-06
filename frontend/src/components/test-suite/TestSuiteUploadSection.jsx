import ErrorBanner from '@/components/ui/ErrorBanner'
import Button from '@/components/ui/Button'
import TestSuiteCaseBuilder from './TestSuiteCaseBuilder'

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
  return (
    <section>
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
      />

      {cases.length > 0 && !loading && !casesLoading && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button size="lg" disabled={!canRun} onClick={onRun}>
            Run {readyCount || 0} test case{readyCount !== 1 ? 's' : ''}
          </Button>
          {unsavedCount > 0 ? (
            <p className="text-xs text-amber-400/90 text-center max-w-md">
              {unsavedCount} case{unsavedCount !== 1 ? 's' : ''} need saving before they can run
              or preload next session.
            </p>
          ) : readyCount === 0 ? (
            <p className="text-xs text-amber-400/90 text-center max-w-md">
              Add and save at least one case to run the batch.
            </p>
          ) : (
            <p className="text-xs text-emerald-400/90">All saved cases ready to run</p>
          )}
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={onRetry} />}
    </section>
  )
}
