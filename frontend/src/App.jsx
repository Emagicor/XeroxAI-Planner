import { useCallback, useState } from 'react'
import AppModeTabs from './components/AppModeTabs'
import Header from './components/Header'
import ResultsSection from './components/ResultsSection'
import UploadSection from './components/UploadSection'
import VantaBackground from './components/VantaBackground'
import TestSuitePanel from './components/testSuite/TestSuitePanel'
import TestSuiteMetrics from './components/testSuite/TestSuiteMetrics'
import TestSuiteProgressPanel from './components/testSuite/TestSuiteProgressPanel'
import TestSuiteUploadSection from './components/testSuite/TestSuiteUploadSection'
import { useFloorPlanAnalysis } from './hooks/useFloorPlanAnalysis'
import { useTestSuiteBatch } from './hooks/useTestSuiteBatch'
import { parseGroundTruthFile } from './utils/testSuite/normalize'

function App() {
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
    error: analyzeError,
    fileInputRef: analyzeFileInputRef,
    handleFileSelect,
    handleDrop,
    handleUpload,
    resetAll: resetAnalyze,
    retryUpload,
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
      setGroundTruthError(err.message || 'Invalid ground truth JSON')
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

  const showAnalyzeUpload = !result && !isTestSuite
  const showTestSuiteSetup = isTestSuite && !testSuite.loading && !testSuite.batchComplete
  const showTestSuiteProgress = isTestSuite && testSuite.loading
  const showBatchResults = isTestSuite && testSuite.batchComplete
  const showAnalyzeResults = Boolean(result) && !isTestSuite

  return (
    <div className="relative min-h-screen font-sans antialiased">
      <VantaBackground />

      <div className="relative z-10">
        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <AppModeTabs mode={appMode} onChange={setAppMode} />

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
            />
          )}

          {showTestSuiteSetup && (
            <TestSuiteUploadSection
              cases={testSuite.cases}
              casesLoading={testSuite.casesLoading}
              casesLoadError={testSuite.casesLoadError}
              loading={testSuite.loading}
              readyCount={testSuite.readyCount}
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
            />
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
            />
          )}

          {result && isTestSuite && !testSuite.batchComplete && !testSuite.loading && (
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
              showJsonDownload
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
