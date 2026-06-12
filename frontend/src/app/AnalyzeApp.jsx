import AnalyzeProgressPanel from '@/components/analysis/AnalyzeProgressPanel'
import Header from '@/components/layout/Header'
import ResultsSection from '@/components/results/ResultsSection'
import ToastContainer from '@/components/layout/ToastContainer'
import UploadSection from '@/components/upload/UploadSection'
import SectionHeader from '@/components/ui/SectionHeader'
import { features } from '@/config/features'
import { useFloorPlanAnalysis } from '@/hooks/useFloorPlanAnalysis'

export default function AnalyzeApp() {
  const {
    file,
    preview,
    result,
    loading: analyzeLoading,
    loadingStep: analyzeLoadingStep,
    loadingSteps: analyzeLoadingSteps,
    analyzeProgress,
    currentPlanIndex,
    error: analyzeError,
    fileInputRef: analyzeFileInputRef,
    handleFileSelect,
    handleDrop,
    handleUpload,
    resetAll: resetAnalyze,
    retryUpload,
    canAnalyze,
  } = useFloorPlanAnalysis()

  const showInitialUpload = !file && !result && !analyzeLoading
  const showAnalyzeUpload = file && !result && analyzeProgress.length <= 1
  const showAnalyzeProgress = analyzeLoading && analyzeProgress.length > 1
  const showAnalyzeResults = Boolean(result)

  return (
    <div className="relative min-h-screen font-sans antialiased app-bg">
      <div className="relative z-10">
        <Header />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {showInitialUpload && (
            <div className="animate-fade-up">
              <SectionHeader
                eyebrow="Floor plan intelligence"
                title="Upload a plan. Get room dimensions in minutes."
                subtitle="Drop a JPG, PNG, or PDF — we extract room areas with AI and let you review before export."
              />
              <div className="mt-8">
                <UploadSection
                  file={file}
                  preview={preview}
                  loading={analyzeLoading}
                  loadingStep={analyzeLoadingStep}
                  loadingSteps={analyzeLoadingSteps}
                  error={analyzeError}
                  fileInputRef={analyzeFileInputRef}
                  onFileSelect={handleFileSelect}
                  onDrop={handleDrop}
                  onUpload={handleUpload}
                  onRetry={retryUpload}
                />
              </div>
            </div>
          )}

          {showAnalyzeUpload && (
            <UploadSection
              file={file}
              preview={preview}
              loading={analyzeLoading}
              loadingStep={analyzeLoadingStep}
              loadingSteps={analyzeLoadingSteps}
              error={analyzeError}
              fileInputRef={analyzeFileInputRef}
              onFileSelect={handleFileSelect}
              onDrop={handleDrop}
              onUpload={handleUpload}
              onRetry={retryUpload}
              onDismiss={resetAnalyze}
              retryLabel="Retry analysis"
              primaryDisabled={!canAnalyze}
            />
          )}

          {showAnalyzeProgress && (
            <AnalyzeProgressPanel
              items={analyzeProgress.map((item, i) =>
                i === currentPlanIndex && analyzeLoading
                  ? { ...item, status: item.status === 'pending' ? 'running' : item.status }
                  : item,
              )}
              currentIndex={currentPlanIndex}
              loadingStep={analyzeLoadingStep}
              loadingSteps={analyzeLoadingSteps}
              totalRegions={analyzeProgress.length}
            />
          )}

          {showAnalyzeResults && (
            <ResultsSection
              result={result}
              onReset={resetAnalyze}
              showJsonDownload={features.jsonDownload}
            />
          )}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
