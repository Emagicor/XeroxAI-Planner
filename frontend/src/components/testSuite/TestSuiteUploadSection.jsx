import ErrorBanner from '../ErrorBanner'
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
      <div className="mb-8 text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/25 bg-accent/10 text-xs text-accent mb-4">
          Evaluation mode
        </div>
        <h2 className="text-2xl font-medium text-[#F0EEE8]">Test suite</h2>
        <p className="text-sm text-[#8B8A82] mt-2 leading-relaxed">
          Saved cases preload from <span className="font-mono">test-suite/manifest.json</span>.
          Click <span className="text-[#F0EEE8]">Save to suite</span> to create a folder under{' '}
          <span className="font-mono">test-suite/cases/</span> and register it in the manifest.
        </p>
      </div>

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
          <button
            type="button"
            disabled={!canRun}
            onClick={onRun}
            className="px-10 py-3.5 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all shadow-lg shadow-accent/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            Run {readyCount || 0} test case{readyCount !== 1 ? 's' : ''}
          </button>
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
