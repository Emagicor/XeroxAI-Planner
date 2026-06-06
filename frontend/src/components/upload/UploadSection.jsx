import ErrorBanner from '@/components/ui/ErrorBanner'
import FileDropZone from '@/components/upload/FileDropZone'
import LoadingIndicator from '@/components/ui/LoadingIndicator'
import Button from '@/components/ui/Button'

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
  onDismiss,
  retryLabel = 'Retry',
  errorTitle,
  errorHint,
  primaryLabel = 'Analyze floor plan',
  primaryDisabled = false,
  showFilePreview = true,
}) {
  return (
    <section>
      <FileDropZone
        file={file}
        preview={preview}
        loading={loading}
        fileInputRef={fileInputRef}
        onFileSelect={onFileSelect}
        onDrop={onDrop}
        showPreview={showFilePreview}
      />

      {file && !loading && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            onClick={onUpload}
            disabled={primaryDisabled}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {primaryLabel}
          </Button>
          {onDismiss && (
            <Button variant="secondary" size="lg" onClick={onDismiss}>
              Start over
            </Button>
          )}
        </div>
      )}

      {loading && (
        <LoadingIndicator steps={loadingSteps} currentStep={loadingStep} />
      )}

      {error && (
        <ErrorBanner
          message={error}
          title={errorTitle}
          hint={errorHint}
          onRetry={onRetry}
          onDismiss={onDismiss}
          retryLabel={retryLabel}
        />
      )}
    </section>
  )
}
