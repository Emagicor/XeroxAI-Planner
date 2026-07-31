import { useState } from 'react'
import AppModeTabs from '@/components/layout/AppModeTabs'
import AnalyzeProgressPanel from '@/components/analysis/AnalyzeProgressPanel'
import Header from '@/components/layout/Header'
import ResultsSection from '@/components/results/ResultsSection'
import ToastContainer from '@/components/layout/ToastContainer'
import UploadSection from '@/components/upload/UploadSection'
import TestSuiteMetrics from '@/components/test-suite/TestSuiteMetrics'
import TestSuiteProgressPanel from '@/components/test-suite/TestSuiteProgressPanel'
import TestSuiteRunHistorySidebar from '@/components/test-suite/TestSuiteRunHistorySidebar'
import TestSuiteUploadSection from '@/components/test-suite/TestSuiteUploadSection'
import SectionHeader from '@/components/ui/SectionHeader'
import { features } from '@/config/features'
import { useFloorPlanAnalysis } from '@/hooks/useFloorPlanAnalysis'
import { useTestSuiteBatch } from '@/hooks/useTestSuiteBatch'
import { formatTestSuiteModelLabel } from '@/constants/testSuiteModels'

export default function DevApp() {
  const [appMode, setAppMode] = useState('analyze')
  const [historySidebarOpen, setHistorySidebarOpen] = useState(true)

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
    modelId,
    setModelId,
    correctionModelId,
    setCorrectionModelId,
    fileInputRef: analyzeFileInputRef,
    handleFileSelect,
    handleDrop,
    handleUpload,
    resetAll: resetAnalyze,
    retryUpload,
    canAnalyze,
  } = analysis

  const testSuite = useTestSuiteBatch()

  const isTestSuite = appMode === 'testSuite'

  const handleResetAnalyze = () => {
    resetAnalyze()
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

  const batchCaseCount =
    testSuite.runProgress.length > 0 ? testSuite.runProgress.length : testSuite.selectedCount

  const testSuiteMain = (
    <>
      {showTestSuiteSetup && (
        <>
          <SectionHeader
            eyebrow="Developer QA"
            title="Test suite — batch benchmark runs"
            subtitle="Each case runs a fresh /analyze call with real API token logging. Results persist under test-suite/test-results/."
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
          totalCases={batchCaseCount}
        />
      )}

      {showBatchResults && (
        <TestSuiteMetrics
          results={testSuite.results}
          onNewBatch={testSuite.clearRunState}
          modelLabel={selectedRunModelLabel}
        />
      )}
    </>
  )

  return (
    <div className="relative min-h-screen font-sans antialiased app-bg">
      {isTestSuite && (
        <TestSuiteRunHistorySidebar
          runs={testSuite.runHistory}
          selectedRunId={testSuite.selectedRunId}
          loading={testSuite.historyLoading}
          open={historySidebarOpen}
          onToggle={() => setHistorySidebarOpen((v) => !v)}
          onSelectRun={(runId) => {
            testSuite.selectRun(runId)
            if (window.innerWidth < 1024) setHistorySidebarOpen(false)
          }}
        />
      )}

      <div className={`relative z-10 transition-[margin] duration-300 ${isTestSuite && historySidebarOpen ? 'lg:ml-72' : ''}`}>
        <Header />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-center justify-between gap-4 mb-6">
            <AppModeTabs mode={appMode} onChange={setAppMode} />
            {isTestSuite && (
              <button
                type="button"
                onClick={() => setHistorySidebarOpen((v) => !v)}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-card text-xs font-medium text-muted hover:text-text hover:border-accent/40 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {historySidebarOpen ? 'Hide history' : 'Run history'}
                {testSuite.runHistory.length > 0 && (
                  <span className="font-mono text-accent">{testSuite.runHistory.length}</span>
                )}
              </button>
            )}
          </div>

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
                  modelId={modelId}
                  onModelChange={setModelId}
                  correctionModelId={correctionModelId}
                  onCorrectionModelChange={setCorrectionModelId}
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
              onDismiss={handleResetAnalyze}
              retryLabel="Retry analysis"
              primaryDisabled={!canAnalyze}
              modelId={modelId}
              onModelChange={setModelId}
              correctionModelId={correctionModelId}
              onCorrectionModelChange={setCorrectionModelId}
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

          {isTestSuite ? testSuiteMain : null}

          {showAnalyzeResults && (
            <ResultsSection
              result={result}
              onReset={handleResetAnalyze}
              showJsonDownload={features.jsonDownload}
            />
          )}
        </main>
      </div>

      <ToastContainer />
    </div>
  )
}
