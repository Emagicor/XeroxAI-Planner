import { useCallback, useState } from 'react'
import AppModeTabs from './components/AppModeTabs'
import Header from './components/Header'
import ResultsSection from './components/ResultsSection'
import UploadSection from './components/UploadSection'
import VantaBackground from './components/VantaBackground'
import TestSuitePanel from './components/testSuite/TestSuitePanel'
import TestSuiteUploadSection from './components/testSuite/TestSuiteUploadSection'
import { useFloorPlanAnalysis } from './hooks/useFloorPlanAnalysis'
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
    loading,
    loadingStep,
    loadingSteps,
    error,
    fileInputRef,
    handleFileSelect,
    handleDrop,
    handleUpload,
    resetAll,
    retryUpload,
  } = analysis

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

  const handleModeChange = (mode) => {
    setAppMode(mode)
  }

  const handleReset = () => {
    resetAll()
    handleGroundTruthClear()
  }

  const canRunTestSuite = Boolean(file && groundTruth)

  const showAnalyzeUpload = !result && !isTestSuite
  const showTestSuiteUpload = !result && isTestSuite
  const showResults = Boolean(result)

  return (
    <div className="relative min-h-screen font-sans antialiased">
      <VantaBackground />

      <div className="relative z-10">
        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <AppModeTabs mode={appMode} onChange={handleModeChange} />

          {showAnalyzeUpload && (
            <UploadSection
              file={file}
              preview={preview}
              loading={loading}
              loadingStep={loadingStep}
              loadingSteps={loadingSteps}
              error={error}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onDrop={handleDrop}
              onUpload={handleUpload}
              onRetry={retryUpload}
            />
          )}

          {showTestSuiteUpload && (
            <TestSuiteUploadSection
              file={file}
              preview={preview}
              loading={loading}
              loadingStep={loadingStep}
              loadingSteps={loadingSteps}
              error={error}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onDrop={handleDrop}
              onUpload={handleUpload}
              onRetry={retryUpload}
              groundTruthFileName={groundTruthFileName}
              groundTruthError={groundTruthError}
              onGroundTruthSelect={handleGroundTruthSelect}
              onGroundTruthClear={handleGroundTruthClear}
              canRun={canRunTestSuite}
            />
          )}

          {showResults && (
            <>
              <div className={isTestSuite ? '' : 'hidden'} aria-hidden={!isTestSuite}>
                <TestSuitePanel
                  hasResult
                  groundTruth={groundTruth}
                  groundTruthFileName={groundTruthFileName}
                  groundTruthError={groundTruthError}
                  aiResult={result}
                  onGroundTruthSelect={handleGroundTruthSelect}
                  onGroundTruthClear={handleGroundTruthClear}
                />
              </div>
              <ResultsSection
                result={result}
                onReset={handleReset}
                showJsonDownload
              />
            </>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
