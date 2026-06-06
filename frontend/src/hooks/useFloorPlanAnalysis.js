import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ANALYZE_STREAM_STEPS,
  DETECT_LOADING_STEPS,
  LOADING_STEPS,
} from '../constants/loading'
import { analyzeFloorPlan } from '../services/analyzeApi'
import { analyzeFloorPlanStream } from '../services/analyzeStreamApi'
import { detectFloorPlans } from '../services/detectApi'
import { buildAnalyzeProgressItems } from '@/utils/analysis/progress'
import {
  activeRegionCount,
  buildActiveProgressItems,
  suggestedExcludeIds,
} from '@/utils/detectionRegions'
import { toastFromError, toastSuccess, toastWarning } from '../stores/toastStore'
import { logApiFailure } from '../utils/apiErrors'

export function useFloorPlanAnalysis() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [detection, setDetection] = useState(null)
  const [excludedRegionIds, setExcludedRegionIds] = useState(() => new Set())
  const [detecting, setDetecting] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [analyzeProgress, setAnalyzeProgress] = useState([])
  const [currentPlanIndex, setCurrentPlanIndex] = useState(-1)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const partialPagesRef = useRef([])

  const activeRegions = detection ? activeRegionCount(detection, excludedRegionIds) : 0

  const loadingSteps = detecting
    ? DETECT_LOADING_STEPS
    : analyzeProgress.length > 1
      ? ANALYZE_STREAM_STEPS
      : LOADING_STEPS

  useEffect(() => {
    if (!loading && !detecting) return
    setLoadingStep(0)
    const t1 = setTimeout(() => setLoadingStep(1), 800)
    const t2 = setTimeout(() => setLoadingStep(2), 2400)
    const t3 = setTimeout(() => setLoadingStep(3), 4800)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [loading, detecting])

  const resetAll = () => {
    setFile(null)
    setPreview(null)
    setDetection(null)
    setExcludedRegionIds(new Set())
    setDetecting(false)
    setResult(null)
    setAnalyzeProgress([])
    setCurrentPlanIndex(-1)
    setError(null)
    partialPagesRef.current = []
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const runDetection = async (selected) => {
    setDetecting(true)
    setError(null)
    setDetection(null)
    setExcludedRegionIds(new Set())
    setResult(null)
    setAnalyzeProgress([])

    try {
      const data = await detectFloorPlans(selected, { isolateUpload: true })
      const autoExcluded = suggestedExcludeIds(data)
      setDetection(data)
      setExcludedRegionIds(new Set(autoExcluded))
      setAnalyzeProgress(
        buildActiveProgressItems(data, autoExcluded, buildAnalyzeProgressItems),
      )

      const active = activeRegionCount(data, autoExcluded)
      if (active > 0) {
        toastSuccess(
          `Found ${active} floor plan${active !== 1 ? 's' : ''} to analyze.` +
            (autoExcluded.length
              ? ` ${autoExcluded.length} dimension table${autoExcluded.length !== 1 ? 's' : ''} auto-excluded.`
              : ''),
          { title: 'Detection complete', duration: 4500 },
        )
      } else if (data?.total_regions > 0) {
        toastWarning('All detected regions were excluded. Include at least one floor plan.', {
          title: 'Nothing to analyze',
        })
      }
    } catch (err) {
      const normalized = logApiFailure(err, { context: 'detect' })
      setError(normalized.userMessage ?? normalized.message)
      setDetection(null)
      toastFromError(normalized, { context: 'detect' })
    } finally {
      setDetecting(false)
    }
  }

  const toggleRegionExclusion = useCallback((regionId) => {
    setExcludedRegionIds((prev) => {
      const next = new Set(prev)
      if (next.has(regionId)) next.delete(regionId)
      else next.add(regionId)
      return next
    })
  }, [])

  useEffect(() => {
    if (!detection) return
    setAnalyzeProgress(
      buildActiveProgressItems(detection, excludedRegionIds, buildAnalyzeProgressItems),
    )
  }, [detection, excludedRegionIds])

  const handleFileSelect = (selected) => {
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setError(null)
    setResult(null)
    setDetection(null)
    runDetection(selected)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }

  const handleUpload = async () => {
    if (!file || activeRegions === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    partialPagesRef.current = []

    const excluded = [...excludedRegionIds]
    const analyzeOpts = {
      detectionId: detection?.detection_id ?? null,
      excludedRegionIds: excluded,
    }

    const useStream = activeRegions > 1 || detection?.scenario?.includes('multi')

    try {
      if (useStream) {
        setAnalyzeProgress((prev) =>
          prev.map((item, i) =>
            i === 0 ? { ...item, status: 'running' } : item,
          ),
        )
        setCurrentPlanIndex(0)

        let meta = {
          filename: file.name,
          content_sha256: detection?.content_sha256 ?? '',
          job_id: crypto.randomUUID(),
          status: 'processing',
          pages: [],
          grand_total_sqft: 0,
          eligible_pages: 0,
          ineligible_pages: 0,
          total_pages: activeRegions,
          source_page_count: detection?.source_page_count,
          total_regions: activeRegions,
          scenario: detection?.scenario,
        }

        await analyzeFloorPlanStream(
          file,
          {
            onDetected: (evt) => {
              meta.total_pages = evt.total_regions
              meta.source_page_count = evt.source_page_count
              meta.scenario = evt.scenario
            },
            onProgress: (evt) => {
              const pageData = evt.data
              const idx = partialPagesRef.current.findIndex(
                (p) => p.page_number === pageData.page_number,
              )
              if (idx >= 0) partialPagesRef.current[idx] = pageData
              else partialPagesRef.current.push(pageData)

              const planIdx = (evt.page ?? 1) - 1
              setCurrentPlanIndex(planIdx)
              setAnalyzeProgress((prev) =>
                prev.map((item, i) =>
                  i === planIdx
                    ? {
                        ...item,
                        status: pageData.eligible === false ? 'error' : 'done',
                        message: pageData.eligible
                          ? `${pageData.rooms?.length ?? 0} rooms · ${Number(pageData.total_area_sqft ?? 0).toFixed(0)} sq ft`
                          : pageData.ineligible_reason ?? 'Skipped',
                      }
                    : i === planIdx + 1
                      ? { ...item, status: 'running' }
                      : item,
                ),
              )

              meta.pages = [...partialPagesRef.current]
              meta.eligible_pages = meta.pages.filter((p) => p.eligible !== false).length
              meta.ineligible_pages = meta.pages.length - meta.eligible_pages
              meta.grand_total_sqft = meta.pages.reduce(
                (s, p) => s + (p.eligible !== false ? Number(p.total_area_sqft ?? 0) : 0),
                0,
              )
            },
            onDone: (evt) => {
              meta.grand_total_sqft = evt.grand_total_sqft
              meta.eligible_pages = evt.eligible_pages
              meta.ineligible_pages = evt.ineligible_pages
              meta.status = 'complete'
            },
            onError: (msg) => {
              throw new Error(msg)
            },
          },
          analyzeOpts,
        )

        setResult(meta)
        toastSuccess('All floor plans analyzed.', { title: 'Analysis complete', duration: 3500 })
      } else {
        const data = await analyzeFloorPlan(file, { isolateUpload: true, ...analyzeOpts })
        setResult(data)
        toastSuccess('Floor plan analyzed successfully.', { title: 'Analysis complete', duration: 3500 })
      }
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
    if (!detection && file) {
      runDetection(file).then(() => handleUpload())
      return
    }
    handleUpload()
  }

  const retryDetection = () => {
    if (file) runDetection(file)
  }

  const browseNewFile = () => fileInputRef.current?.click()

  return {
    file,
    preview,
    detection,
    excludedRegionIds,
    activeRegions,
    detecting,
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
    toggleRegionExclusion,
    resetAll,
    retryUpload,
    retryDetection,
    browseNewFile,
    canAnalyze:
      Boolean(file) &&
      !detecting &&
      !loading &&
      Boolean(detection) &&
      activeRegions > 0,
  }
}
