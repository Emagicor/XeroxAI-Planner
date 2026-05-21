import Header from './components/Header'
import ResultsSection from './components/ResultsSection'
import UploadSection from './components/UploadSection'
import VantaBackground from './components/VantaBackground'
import { useFloorPlanAnalysis } from './hooks/useFloorPlanAnalysis'

function App() {
  const {
    file,
    preview,
    result,
    loading,
    loadingStep,
    loadingSteps,
    error,
    activeRoom,
    setActiveRoom,
    fileInputRef,
    handleFileSelect,
    handleDrop,
    handleUpload,
    resetAll,
    retryUpload,
    downloadCSV,
  } = useFloorPlanAnalysis()

  return (
    <div className="relative min-h-screen font-sans antialiased">
      <VantaBackground />

      <div className="relative z-10">
        <Header />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!result && (
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

        {result && (
          <ResultsSection
            result={result}
            activeRoom={activeRoom}
            onSelectRoom={setActiveRoom}
            onDownloadCSV={downloadCSV}
            onReset={resetAll}
          />
        )}
        </main>
      </div>
    </div>
  )
}

export default App
