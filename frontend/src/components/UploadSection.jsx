import ErrorBanner from './ErrorBanner'
import FileDropZone from './FileDropZone'
import LoadingIndicator from './LoadingIndicator'

export default function UploadSection({
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
  hidePrimaryButton = false,
  primaryLabel = 'Analyze Floor Plan',
}) {
  return (
    <section className="mb-8">
      <FileDropZone
        file={file}
        preview={preview}
        loading={loading}
        fileInputRef={fileInputRef}
        onFileSelect={onFileSelect}
        onDrop={onDrop}
      />

      {file && !loading && !hidePrimaryButton && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onUpload}
            className="px-8 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
          >
            {primaryLabel}
          </button>
        </div>
      )}

      {loading && (
        <LoadingIndicator steps={loadingSteps} currentStep={loadingStep} />
      )}

      {error && <ErrorBanner message={error} onRetry={onRetry} />}
    </section>
  )
}
