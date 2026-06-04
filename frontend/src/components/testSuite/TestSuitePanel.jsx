import GroundTruthUpload from './GroundTruthUpload'
import TestSuiteMetrics from './TestSuiteMetrics'

/**
 * Shown on Test Suite tab when an analysis result already exists (e.g. from Analyze tab).
 */
export default function TestSuitePanel({
  hasResult,
  groundTruth,
  groundTruthFileName,
  groundTruthError,
  aiResult,
  onGroundTruthSelect,
  onGroundTruthClear,
}) {
  if (!hasResult) return null

  return (
    <div className="mb-8">
      <div className="mb-4 p-4 rounded-xl border border-accent/25 bg-accent/5">
        <p className="text-sm font-medium text-[#F0EEE8]">
          Using your current analysis session
        </p>
        <p className="text-xs text-[#8B8A82] mt-1">
          Results are shared across Analyze and Test Suite. Upload ground truth JSON
          below to score this run — no need to analyze again.
        </p>
      </div>

      <GroundTruthUpload
        fileName={groundTruthFileName}
        error={groundTruthError}
        onSelect={onGroundTruthSelect}
        onClear={onGroundTruthClear}
      />

      {groundTruth && (
        <div className="mt-6">
          <TestSuiteMetrics
            groundTruth={groundTruth}
            aiResult={aiResult}
            evalError={groundTruthError}
          />
        </div>
      )}
    </div>
  )
}
