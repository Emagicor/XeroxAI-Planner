import UploadSection from '../UploadSection'
import GroundTruthUpload from './GroundTruthUpload'

export default function TestSuiteUploadSection({
  file,
  preview,
  loading,
  loadingStep,
  loadingSteps,
  error,
  fileInputRef,
  onFileSelect,
  onDrop,
  onUpload,
  onRetry,
  groundTruthFileName,
  groundTruthError,
  onGroundTruthSelect,
  onGroundTruthClear,
  canRun,
}) {
  return (
    <section>
      <div className="mb-4 text-center max-w-xl mx-auto">
        <h2 className="text-lg font-medium text-[#F0EEE8]">Test suite mode</h2>
        <p className="text-sm text-[#8B8A82] mt-1">
          Upload a floor plan and ground truth JSON. After analysis, metrics compare
          AI output to your labels mathematically.
        </p>
      </div>

      <UploadSection
        file={file}
        preview={preview}
        loading={loading}
        loadingStep={loadingStep}
        loadingSteps={loadingSteps}
        error={error}
        fileInputRef={fileInputRef}
        onFileSelect={onFileSelect}
        onDrop={onDrop}
        onUpload={onUpload}
        onRetry={onRetry}
        hidePrimaryButton
      />

      <GroundTruthUpload
        fileName={groundTruthFileName}
        error={groundTruthError}
        onSelect={onGroundTruthSelect}
        onClear={onGroundTruthClear}
      />

      {file && !loading && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            disabled={!canRun}
            onClick={onUpload}
            className="px-8 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Run analysis & evaluate
          </button>
          {!groundTruthFileName && (
            <p className="text-xs text-amber-400/90">
              Ground truth JSON is required in test suite mode.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
