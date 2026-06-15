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
      <div className="rounded-xl border border-line mb-4 p-4">
        <h3 className="font-medium text-text mb-2">
          How to Analyze a Floor Plan
        </h3>

        <ol className="space-y-2 text-sm text-muted list-decimal list-inside">
          <li>Upload a clear floor plan image or PDF.</li>
          <li>Each page should contain only one floor plan.</li>
          <li>Ensure room labels and dimensions are visible.</li>
          <li>Avoid blurry, cropped, or low-resolution files.</li>
          <li>
            Click <strong>Analyze</strong> to extract room information.
          </li>
          <li>Review the extracted dimensions and AI findings.</li>
        </ol>
      </div>
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
          <Button size="lg" onClick={onUpload} disabled={primaryDisabled}>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
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
  );
}
