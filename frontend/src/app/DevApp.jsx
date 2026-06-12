import { useCallback, useState } from 'react'
import AppModeTabs from '@/components/layout/AppModeTabs'
import AnalyzeProgressPanel from '@/components/analysis/AnalyzeProgressPanel'
import Header from '@/components/layout/Header'
import ResultsSection from '@/components/results/ResultsSection'
import ToastContainer from '@/components/layout/ToastContainer'
import UploadSection from '@/components/upload/UploadSection'
import TestSuitePanel from '@/components/test-suite/TestSuitePanel'
import TestSuiteMetrics from '@/components/test-suite/TestSuiteMetrics'
import TestSuiteProgressPanel from '@/components/test-suite/TestSuiteProgressPanel'
import TestSuiteRunHistory from '@/components/test-suite/TestSuiteRunHistory'
import TestSuiteUploadSection from '@/components/test-suite/TestSuiteUploadSection'
import SectionHeader from '@/components/ui/SectionHeader'
import { features } from '@/config/features'
import { useFloorPlanAnalysis } from '@/hooks/useFloorPlanAnalysis'
import { useTestSuiteBatch } from '@/hooks/useTestSuiteBatch'
import { formatTestSuiteModelLabel } from '@/constants/testSuiteModels'
import { parseGroundTruthFile } from '@/utils/testSuite/normalize'
import { toastError } from '@/stores/toastStore'

export default function DevApp() {
  const [appMode, setAppMode] = useState('analyze')

  const [groundTruth, setGroundTruth] = useState(null)
  const [groundTruthFileName, setGroundTruthFileName] = useState(null)
  const [groundTruthError, setGroundTruthError] = useState(null)

  const analysis = useFloorPlanAnalysis()
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
  } = analysis

  const testSuite = useTestSuiteBatch({ cachedAnalyzeResult: result })

  const isTestSuite = appMode === 'testSuite'

  const handleGroundTruthSelect = useCallback(async (gtFile) => {
    try {
      const text = await gtFile.text()
      const parsed = parseGroundTruthFile(text)
      setGroundTruth(parsed.raw)
      setGroundTruthFileName(gtFile.name)
      setGroundTruthError(null)
    } catch (err) {
      setGroundTruth(null)
      setGroundTruthFileName(null)
      const msg = err.message || 'Invalid ground truth JSON'
      setGroundTruthError(msg)
      toastError(msg, { title: 'Ground truth invalid' })
    }
  }, [])

  const handleGroundTruthClear = useCallback(() => {
    setGroundTruth(null)
    setGroundTruthFileName(null)
    setGroundTruthError(null)
  }, [])

  const handleReset = () => {
    resetAnalyze()
    testSuite.clearRunState()
    handleGroundTruthClear()
  }

  const showInitialUpload = !file && !result && !analyzeLoading && !isTestSuite
  const showAnalyzeUpload =
    !isTestSuite && file && !result && analyzeProgress.length <= 1
  const showAnalyzeProgress =
    !isTestSuite && analyzeLoading && analyzeProgress.length > 1
  const showTestSuiteSetup = isTestSuite && !testSuite.loading && !testSuite.hasResults
  const showTestSuiteProgress = isTestSuite && testSuite.loading
  const showBatchResults = isTestSuite && testSuite.hasResults
  const selectedRunModelLabel = formatTestSuiteModelLabel(
    testSuite.runHistory.find((run) => run.runId === testSuite.selectedRunId),
  )
  const showAnalyzeResults = Boolean(result) && !isTestSuite

  return (
    <div className="relative min-h-screen font-sans antialiased app-bg">
      <div className="relative z-10">
        <Header />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <AppModeTabs mode={appMode} onChange={setAppMode} />

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
              onDismiss={handleReset}
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

          {isTestSuite && !testSuite.loading && (
            <div className="mb-6">
              <TestSuiteRunHistory
                runs={testSuite.runHistory}
                selectedRunId={testSuite.selectedRunId}
                loading={testSuite.historyLoading}
                onSelectRun={testSuite.selectRun}
              />
            </div>
          )}

          {showTestSuiteSetup && (
            <>
              <SectionHeader
                eyebrow="Quality assurance"
                title="Batch test against ground truth"
                subtitle="Build test cases, run analysis in bulk, and compare AI output to expected room measurements."
              />
              <TestSuiteUploadSection
                cases={testSuite.cases}
                casesLoading={testSuite.casesLoading}
                casesLoadError={testSuite.casesLoadError}
                loading={testSuite.loading}
                readyCount={testSuite.readyCount}
                selectedCount={testSuite.selectedCount}
                error={testSuite.error}
                bulkInputRef={testSuite.bulkInputRef}
                onAddEmptyCase={testSuite.addEmptyCase}
                onAddInputFiles={testSuite.addInputFiles}
                onBulkDrop={testSuite.handleBulkInputDrop}
                onCaseInputSelect={testSuite.setCaseInputFile}
                onCaseGroundTruthSelect={testSuite.setCaseGroundTruth}
                onCaseGroundTruthClear={testSuite.clearCaseGroundTruth}
                onSaveCase={testSuite.saveCase}
                onRemoveCase={testSuite.removeCase}
                onReloadCases={testSuite.reloadCases}
                canRun={testSuite.canRun}
                unsavedCount={testSuite.unsavedCount}
                onRun={testSuite.runBatch}
                onRetry={testSuite.retryBatch}
                selectedModelId={testSuite.selectedModelId}
                onModelChange={testSuite.setSelectedModelId}
                isCaseSelected={testSuite.isCaseSelected}
                onToggleCaseSelection={testSuite.toggleCaseSelection}
                onSelectAll={testSuite.selectAllRunnable}
                onDeselectAll={testSuite.deselectAll}
                canRunCase={testSuite.isCaseRunnable}
              />
            </>
          )}

          {showTestSuiteProgress && (
            <TestSuiteProgressPanel
              runProgress={testSuite.runProgress}
              currentIndex={testSuite.currentIndex}
              loadingStep={testSuite.loadingStep}
              loadingSteps={testSuite.loadingSteps}
              totalCases={testSuite.cases.length}
            />
          )}

          {showBatchResults && (
            <TestSuiteMetrics
              results={testSuite.results}
              onNewBatch={handleReset}
              modelLabel={selectedRunModelLabel}
            />
          )}

          {result && isTestSuite && !testSuite.hasResults && !testSuite.loading && (
            <TestSuitePanel
              hasResult
              groundTruth={groundTruth}
              groundTruthFileName={groundTruthFileName}
              groundTruthError={groundTruthError}
              aiResult={result}
              onGroundTruthSelect={handleGroundTruthSelect}
              onGroundTruthClear={handleGroundTruthClear}
            />
          )}

          {showAnalyzeResults && (
            <ResultsSection
              result={result}
              onReset={handleReset}
              showJsonDownload={features.jsonDownload}
            />
          )}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
