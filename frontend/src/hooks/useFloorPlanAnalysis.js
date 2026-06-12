import { useEffect, useRef, useState } from 'react'
import { ANALYZE_STREAM_STEPS, LOADING_STEPS } from '../constants/loading'
import { runFloorPlanAnalyze, shouldUseAnalyzeStream } from '../services/floorPlanPipeline'
import { toastFromError, toastSuccess } from '../stores/toastStore'
import { logApiFailure } from '../utils/apiErrors'

export function useFloorPlanAnalysis() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [analyzeProgress, setAnalyzeProgress] = useState([])
  const [currentPlanIndex, setCurrentPlanIndex] = useState(-1)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const loadingSteps =
    analyzeProgress.length > 1 ? ANALYZE_STREAM_STEPS : LOADING_STEPS

  useEffect(() => {
    if (!loading) return
    setLoadingStep(0)
    const t1 = setTimeout(() => setLoadingStep(1), 800)
    const t2 = setTimeout(() => setLoadingStep(2), 2400)
    const t3 = setTimeout(() => setLoadingStep(3), 4800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [loading])

  const resetAll = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setAnalyzeProgress([])
    setCurrentPlanIndex(-1)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileSelect = (selected) => {
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setError(null)
    setResult(null)
    setAnalyzeProgress([])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }

  const handleUpload = async () => {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setCurrentPlanIndex(-1)

    if (shouldUseAnalyzeStream(file)) {
      setAnalyzeProgress([])
    }

    try {
      const data = await runFloorPlanAnalyze(file, {
        isolateUpload: true,
        onStreamEvent: ({ type, planIndex, pageData, progressItems }) => {
          if (type === 'detected' && progressItems?.length) {
            setAnalyzeProgress(
              progressItems.map((item, index) =>
                index === 0 ? { ...item, status: 'running' } : item,
              ),
            )
            setCurrentPlanIndex(0)
          }
          if (type === 'progress') {
            setCurrentPlanIndex(planIndex)
            setAnalyzeProgress((prev) =>
              prev.map((item, index) =>
                index === planIndex
                  ? {
                      ...item,
                      status: pageData.eligible === false ? 'error' : 'done',
                      message: pageData.eligible
                        ? `${pageData.rooms?.length ?? 0} rooms · ${Number(pageData.total_area_sqft ?? 0).toFixed(0)} sq ft`
                        : pageData.ineligible_reason ?? 'Skipped',
                    }
                  : index === planIndex + 1
                    ? { ...item, status: 'running' }
                    : item,
              ),
            )
          }
        },
      })

      setResult(data)
      const planCount = data.total_regions ?? data.pages?.length ?? 1
      toastSuccess(
        planCount > 1 ? 'All floor plans analyzed.' : 'Floor plan analyzed successfully.',
        { title: 'Analysis complete', duration: 3500 },
      )
    } catch (err) {
      const normalized = logApiFailure(err, { context: 'analyze' })
      setError(normalized.userMessage ?? normalized.message)
      toastFromError(normalized, { context: 'analyze' })
    } finally {
      setLoading(false)
      setCurrentPlanIndex(-1)
    }
  }

  const retryUpload = () => {
    setError(null)
    handleUpload()
  }

  const browseNewFile = () => fileInputRef.current?.click()

  return {
    file,
    preview,
    result,
    loading,
    loadingStep,
    loadingSteps,
    analyzeProgress,
    currentPlanIndex,
    error,
    fileInputRef,
    handleFileSelect,
    handleDrop,
    handleUpload,
    resetAll,
    retryUpload,
    browseNewFile,
    canAnalyze: Boolean(file) && !loading,
  }
}
