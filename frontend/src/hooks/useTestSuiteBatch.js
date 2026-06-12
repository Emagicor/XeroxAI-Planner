import { useCallback, useEffect, useRef, useState } from 'react'
import { LOADING_STEPS } from '../constants/loading'
import {
  DEFAULT_TEST_SUITE_MODEL_ID,
  getTestSuiteModelById,
  visionOverrideFromModelChoice,
} from '../constants/testSuiteModels'
import { runFloorPlanPipeline } from '../services/floorPlanPipeline'
import {
  deleteTestSuiteCase,
  fetchResultsIndex,
  fetchRunResults,
  fetchTestCaseGroundTruth,
  fetchTestCaseInput,
  fetchTestSuiteCases,
  saveRunResults,
  saveTestSuiteCase,
  updateTestSuiteCase,
} from '../services/testSuiteApi'
import { evaluateAgainstGroundTruth } from '../utils/testSuite/compare'
import { cloneFileForUpload, delay } from '../utils/cloneUploadFile'
import { sha256Hex } from '../utils/fileHash'
import { parseGroundTruthFile } from '../utils/testSuite/normalize'
import { toastFromError, toastSuccess, toastWarning } from '../stores/toastStore'
import { logApiFailure } from '../utils/apiErrors'

/** Gap between cases — full isolation like separate Analyze-tab sessions. */
const INTER_CASE_DELAY_MS = 2500

function createDraftCase(inputFile = null) {
  return {
    id: crypto.randomUUID(),
    persisted: false,
    permanent: false,
    dirty: false,
    label: null,
    inputFile,
    preview: inputFile ? URL.createObjectURL(inputFile) : null,
    groundTruth: null,
    gtError: null,
    saveError: null,
    saving: false,
  }
}

function isFloorPlanFile(file) {
  return /\.(jpe?g|png|pdf)$/i.test(file.name)
}

function isCaseReady(c) {
  return Boolean(c.inputFile) && Boolean(c.groundTruth) && !c.gtError
}

function canSaveCase(c) {
  return isCaseReady(c) && !c.saving && (!c.persisted || c.dirty)
}

function canRunCase(c) {
  return c.persisted && !c.dirty && isCaseReady(c) && !c.saving
}

async function loadPersistedCase(meta) {
  const [inputBlob, gtText] = await Promise.all([
    fetchTestCaseInput(meta),
    fetchTestCaseGroundTruth(meta),
  ])
  const inputFile = new File([inputBlob], meta.inputFile, {
    type: inputBlob.type || 'application/octet-stream',
  })
  const parsed = parseGroundTruthFile(gtText)
  return {
    id: meta.id,
    persisted: true,
    permanent: Boolean(meta.permanent),
    dirty: false,
    label: meta.label ?? meta.id,
    inputFile,
    preview: URL.createObjectURL(inputFile),
    groundTruth: { raw: parsed.raw, fileName: meta.groundTruthFile ?? 'ground-truth.json' },
    gtError: null,
    saveError: null,
    saving: false,
  }
}

function resultStatus(row) {
  if (row.error || row.evalError || !row.evaluation) return 'failed'
  return (row.evaluation.roomF1 ?? 0) >= 0.85 ? 'passed' : 'failed'
}

function serializeBatchResult(row, executedAt) {
  return {
    testCaseId: row.caseId,
    input: {
      fileName: row.inputFileName,
      sha256: row.inputSha256,
      groundTruthFileName: row.groundTruthFileName,
    },
    output: {
      aiResult: row.aiResult,
      evaluation: row.evaluation,
      evalError: row.evalError,
      error: row.error,
    },
    status: resultStatus(row),
    executedAt,
  }
}

async function hydratePersistedResults(entries, caseMetas) {
  const metaById = new Map(caseMetas.map((m) => [m.id, m]))
  return Promise.all(
    entries.map(async (entry) => {
      const meta = metaById.get(entry.testCaseId)
      let preview = null
      if (meta) {
        try {
          const blob = await fetchTestCaseInput(meta)
          preview = URL.createObjectURL(blob)
        } catch {
          /* preview optional for historical runs */
        }
      }
      return {
        caseId: entry.testCaseId,
        inputFileName: entry.input?.fileName,
        inputSha256: entry.input?.sha256,
        groundTruthFileName: entry.input?.groundTruthFileName,
        preview,
        aiResult: entry.output?.aiResult ?? null,
        evaluation: entry.output?.evaluation ?? null,
        evalError: entry.output?.evalError ?? null,
        error: entry.output?.error ?? null,
      }
    }),
  )
}

async function snapshotCasesForBatch(caseList) {
  return Promise.all(
    caseList.map(async (c) => {
      const inputFile = await cloneFileForUpload(c.inputFile)
      const inputSha256 = await sha256Hex(inputFile)
      return {
        id: c.id,
        preview: c.preview,
        groundTruth: c.groundTruth,
        inputFile,
        inputFileName: c.inputFile.name,
        inputSha256,
        groundTruthFileName: c.groundTruth.fileName,
      }
    }),
  )
}

/**
 * @param {{ cachedAnalyzeResult?: object | null, enabled?: boolean }} options
 */
export function useTestSuiteBatch({ cachedAnalyzeResult = null, enabled = true } = {}) {
  const [cases, setCases] = useState([])
  const [casesLoading, setCasesLoading] = useState(enabled)
  const [casesLoadError, setCasesLoadError] = useState(null)
  const [results, setResults] = useState([])
  const [runHistory, setRunHistory] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(enabled)
  const [runProgress, setRunProgress] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [error, setError] = useState(null)
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_TEST_SUITE_MODEL_ID)
  const [selectedCaseIds, setSelectedCaseIds] = useState(() => new Set())
  const bulkInputRef = useRef(null)
  const casesRef = useRef(cases)
  const cachedAnalyzeRef = useRef(cachedAnalyzeResult)

  useEffect(() => {
    casesRef.current = cases
  }, [cases])

  useEffect(() => {
    cachedAnalyzeRef.current = cachedAnalyzeResult
  }, [cachedAnalyzeResult])

  const revokePreview = (preview) => {
    if (preview) URL.revokeObjectURL(preview)
  }

  const revokeAllPreviews = (caseList) => {
    for (const c of caseList) revokePreview(c.preview)
  }

  const clearRunState = () => {
    setResults([])
    setSelectedRunId(null)
    setRunProgress([])
    setLoading(false)
    setCurrentIndex(-1)
    setError(null)
  }

  const loadRunById = useCallback(async (runId, caseMetas) => {
    const entries = await fetchRunResults(runId)
    const hydrated = await hydratePersistedResults(entries, caseMetas)
    setResults(hydrated)
    setSelectedRunId(runId)
    setRunProgress([])
    setError(null)
  }, [])

  const selectRun = useCallback(
    async (runId) => {
      if (!runId || runId === selectedRunId) return
      try {
        const metas = await fetchTestSuiteCases()
        await loadRunById(runId, metas)
      } catch (err) {
        const msg = err.message || 'Could not load run results'
        setError(msg)
        toastWarning(msg, { title: 'Run history' })
      }
    },
    [loadRunById, selectedRunId],
  )

  const reloadPersistedCases = useCallback(async (excludeDraftIds = []) => {
    const exclude = new Set(excludeDraftIds)
    const drafts = casesRef.current.filter((c) => !c.persisted && !exclude.has(c.id))
    revokeAllPreviews(casesRef.current.filter((c) => c.persisted))

    const metas = await fetchTestSuiteCases()
    if (!metas.length) {
      setCases(drafts)
      return
    }

    const results = await Promise.allSettled(metas.map(loadPersistedCase))
    const loaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    const failed = results.filter((r) => r.status === 'rejected')

    setCases([...loaded, ...drafts])

    if (failed.length === results.length) {
      throw failed[0].reason
    }
    if (failed.length > 0) {
      setCasesLoadError(
        `${failed.length} of ${results.length} saved cases failed to load.`,
      )
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setCasesLoading(false)
      setHistoryLoading(false)
      return undefined
    }

    let cancelled = false

    async function loadCasesAndHistory() {
      setCasesLoading(true)
      setHistoryLoading(true)
      setCasesLoadError(null)
      try {
        await reloadPersistedCases()
        const index = await fetchResultsIndex()
        if (cancelled) return
        setRunHistory(index)

        if (index.length > 0) {
          const latest = index[index.length - 1]
          const metas = await fetchTestSuiteCases()
          if (!cancelled) {
            await loadRunById(latest.runId, metas)
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err.message || 'Could not load saved test cases'
          setCasesLoadError(msg)
          toastWarning(msg, { title: 'Test suite load failed' })
        }
      } finally {
        if (!cancelled) {
          setCasesLoading(false)
          setHistoryLoading(false)
        }
      }
    }

    loadCasesAndHistory()
    return () => {
      cancelled = true
    }
  }, [enabled, reloadPersistedCases, loadRunById])

  useEffect(() => {
    if (casesLoading) return
    setSelectedCaseIds((prev) => {
      const runnableIds = new Set(cases.filter(canRunCase).map((c) => c.id))
      const allIds = new Set(cases.map((c) => c.id))
      const next = new Set()

      for (const id of prev) {
        if (allIds.has(id) && runnableIds.has(id)) {
          next.add(id)
        }
      }

      for (const id of runnableIds) {
        if (!prev.has(id)) {
          next.add(id)
        }
      }

      if (prev.size === 0 && runnableIds.size > 0) {
        return runnableIds
      }

      return next
    })
  }, [cases, casesLoading])

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

  const markCase = (caseId, patch) => {
    setCases((prev) => prev.map((c) => (c.id === caseId ? { ...c, ...patch } : c)))
  }

  const saveCase = async (caseId) => {
    const current = casesRef.current.find((c) => c.id === caseId)
    if (!current || !canSaveCase(current)) return

    markCase(caseId, { saving: true, saveError: null })
    try {
      const label =
        current.label || current.inputFile.name.replace(/\.[^.]+$/, '') || caseId

      if (current.persisted) {
        await updateTestSuiteCase(caseId, {
          label,
          inputFile: current.inputFile,
          groundTruth: current.groundTruth.raw,
          groundTruthFileName: current.groundTruth.fileName,
        })
        await reloadPersistedCases()
      } else {
        await saveTestSuiteCase({
          label,
          inputFile: current.inputFile,
          groundTruth: current.groundTruth.raw,
          groundTruthFileName: current.groundTruth.fileName,
        })
        revokePreview(current.preview)
        await reloadPersistedCases([caseId])
      }
      setCasesLoadError(null)
    } catch (err) {
      const normalized = logApiFailure(err, { context: 'test-suite/save' })
      const msg = normalized.userMessage ?? normalized.message
      markCase(caseId, {
        saving: false,
        saveError: msg,
      })
      toastFromError(normalized, { title: 'Save failed' })
    }
  }

  const addEmptyCase = () => {
    setCases((prev) => [createDraftCase(), ...prev])
    clearRunState()
  }

  const addInputFiles = (files) => {
    const arr = Array.from(files ?? []).filter(isFloorPlanFile)
    if (!arr.length) return
    setCases((prev) => [...arr.map((f) => createDraftCase(f)), ...prev])
    clearRunState()
  }

  const handleBulkInputDrop = (e) => {
    e.preventDefault()
    const dropped = [...e.dataTransfer.files].filter(isFloorPlanFile)
    if (dropped.length) addInputFiles(dropped)
  }

  const setCaseInputFile = (caseId, file) => {
    if (!file || !isFloorPlanFile(file)) return

    const current = casesRef.current.find((c) => c.id === caseId)
    if (!current) return

    revokePreview(current.preview)
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              inputFile: file,
              preview: URL.createObjectURL(file),
              dirty: c.persisted ? true : c.dirty,
              saveError: null,
            }
          : c,
      ),
    )
    clearRunState()
  }

  const setCaseGroundTruth = async (caseId, file) => {
    if (!file) return

    try {
      const text = await file.text()
      const parsed = parseGroundTruthFile(text)
      const groundTruth = { raw: parsed.raw, fileName: file.name }

      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                groundTruth,
                gtError: null,
                dirty: c.persisted ? true : c.dirty,
                saveError: null,
              }
            : c,
        ),
      )
      clearRunState()
    } catch (err) {
      setCases((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? { ...c, groundTruth: null, gtError: err.message || 'Invalid JSON', saveError: null }
            : c,
        ),
      )
      clearRunState()
    }
  }

  const clearCaseGroundTruth = (caseId) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              groundTruth: null,
              gtError: null,
              dirty: c.persisted ? true : c.dirty,
              saveError: null,
            }
          : c,
      ),
    )
    clearRunState()
  }

  const removeCase = async (caseId) => {
    const target = casesRef.current.find((c) => c.id === caseId)
    if (!target) return

    if (target.persisted) {
      try {
        await deleteTestSuiteCase(caseId)
      } catch (err) {
        markCase(caseId, { saveError: err.message || 'Could not delete test case' })
        return
      }
    }

    revokePreview(target.preview)
    setCases((prev) => prev.filter((c) => c.id !== caseId))
    clearRunState()
  }

  const reloadCases = useCallback(async () => {
    setCasesLoading(true)
    setCasesLoadError(null)
    try {
      await reloadPersistedCases()
    } catch (err) {
      setCasesLoadError(err.message || 'Could not reload test cases')
    } finally {
      setCasesLoading(false)
    }
  }, [reloadPersistedCases])

  const runnableCases = cases.filter(canRunCase)
  const readyCount = runnableCases.length
  const selectedCount = runnableCases.filter((c) => selectedCaseIds.has(c.id)).length
  const unsavedCount = cases.filter((c) => !c.persisted || c.dirty).length

  const canRun =
    selectedCount > 0 &&
    !cases.some((c) => c.dirty) &&
    !loading &&
    !casesLoading

  const toggleCaseSelection = useCallback((caseId) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev)
      if (next.has(caseId)) next.delete(caseId)
      else next.add(caseId)
      return next
    })
  }, [])

  const selectAllRunnable = useCallback(() => {
    setSelectedCaseIds(new Set(casesRef.current.filter(canRunCase).map((c) => c.id)))
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedCaseIds(new Set())
  }, [])

  const isCaseSelected = useCallback(
    (caseId) => selectedCaseIds.has(caseId),
    [selectedCaseIds],
  )

  const isCaseRunnable = useCallback((c) => canRunCase(c), [])

  const hasResults = !loading && results.length > 0

  const runBatch = useCallback(async () => {
    const selected = selectedCaseIds
    const currentCases = casesRef.current.filter(
      (c) => canRunCase(c) && selected.has(c.id),
    )

    if (!currentCases.length || loading) return

    setLoading(true)
    setError(null)
    setResults([])
    setCurrentIndex(-1)

    let snapshot
    try {
      snapshot = await snapshotCasesForBatch(currentCases)
    } catch (err) {
      const normalized = logApiFailure(err, { context: 'test-suite/batch' })
      const msg = normalized.userMessage ?? normalized.message
      setError(msg)
      toastFromError(normalized, { title: 'Batch failed to start' })
      setLoading(false)
      return
    }

    setRunProgress(
      snapshot.map((c) => ({
        caseId: c.id,
        inputFileName: c.inputFileName,
        groundTruthFileName: c.groundTruthFileName,
        preview: c.preview,
        status: 'pending',
        message: null,
      })),
    )

    const batchResults = []
    const modelChoice = getTestSuiteModelById(selectedModelId)
    const visionOverride = visionOverrideFromModelChoice(modelChoice)

    for (let i = 0; i < snapshot.length; i += 1) {
      if (i > 0) {
        await delay(INTER_CASE_DELAY_MS)
      }

      setCurrentIndex(i)
      const testCase = snapshot[i]

      setRunProgress((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'running', message: 'Analyzing…' } : item,
        ),
      )

      try {
        const cached = cachedAnalyzeRef.current
        const cacheHash = cached?.content_sha256 ?? ''
        let aiResult
        let usedCachedAnalyze = false

        const canReuseAnalyzeCache =
          modelChoice.matchesAnalyzeTab &&
          cacheHash &&
          testCase.inputSha256 &&
          cacheHash === testCase.inputSha256

        if (canReuseAnalyzeCache) {
          aiResult = cached
          usedCachedAnalyze = true
        } else {
          const { result } = await runFloorPlanPipeline(testCase.inputFile, {
            isolateUpload: true,
            ...visionOverride,
          })
          aiResult = result
        }

        const responseHash = aiResult.content_sha256 ?? ''
        if (
          responseHash &&
          testCase.inputSha256 &&
          responseHash !== testCase.inputSha256
        ) {
          console.warn(
            `[test-suite] Case ${i + 1} hash mismatch: sent ${testCase.inputSha256.slice(0, 16)}…, ` +
              `server ${responseHash.slice(0, 16)}…`,
          )
        }

        let evaluation = null
        let evalError = null
        try {
          evaluation = evaluateAgainstGroundTruth(
            testCase.groundTruth.raw,
            aiResult,
          )
        } catch (err) {
          evalError = err.message || 'Evaluation failed'
        }

        batchResults.push({
          caseId: testCase.id,
          inputFileName: testCase.inputFileName,
          inputSha256: testCase.inputSha256,
          responseSha256: responseHash,
          groundTruthFileName: testCase.groundTruthFileName,
          preview: testCase.preview,
          aiResult,
          evaluation,
          evalError,
          error: null,
        })

        setRunProgress((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: evalError ? 'warning' : 'done',
                  message: evalError
                    ? evalError
                    : usedCachedAnalyze
                      ? 'Complete (reused Analyze tab result)'
                      : 'Complete',
                }
              : item,
          ),
        )
      } catch (err) {
        const normalized = logApiFailure(err, { context: 'test-suite/analyze' })
        const msg = normalized.userMessage ?? normalized.message
        batchResults.push({
          caseId: testCase.id,
          inputFileName: testCase.inputFileName,
          groundTruthFileName: testCase.groundTruthFileName,
          preview: testCase.preview,
          aiResult: null,
          evaluation: null,
          evalError: null,
          error: msg,
        })

        setRunProgress((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'error', message: msg }
              : item,
          ),
        )
        toastFromError(normalized, {
          title: `Case ${i + 1} failed`,
        })
      }
    }

    const failed = batchResults.filter((r) => r.error).length
    if (failed === 0) {
      toastSuccess(`All ${batchResults.length} test case(s) completed.`, {
        title: 'Batch complete',
      })
    } else if (failed < batchResults.length) {
      toastWarning(`${failed} of ${batchResults.length} case(s) failed. Expand results for details.`, {
        title: 'Batch finished with errors',
      })
    } else {
      toastWarning('Every test case failed. Is the backend running?', {
        title: 'Batch failed',
      })
    }

    setResults(batchResults)
    setCurrentIndex(-1)
    setLoading(false)

    const executedAt = new Date().toISOString()
    try {
      const summary = await saveRunResults(
        batchResults.map((row) => serializeBatchResult(row, executedAt)),
        {
          id: modelChoice.id,
          label: modelChoice.label,
          provider: modelChoice.provider,
          model: modelChoice.model,
        },
      )
      setRunHistory((prev) => [...prev, summary])
      setSelectedRunId(summary.runId)
    } catch (err) {
      toastWarning(err.message || 'Results were not saved to disk', {
        title: 'Run persistence failed',
      })
    }
  }, [loading, selectedModelId, selectedCaseIds])

  const retryBatch = () => {
    setError(null)
    runBatch()
  }

  return {
    cases,
    casesLoading,
    casesLoadError,
    results,
    runProgress,
    loading,
    loadingStep,
    loadingSteps: LOADING_STEPS,
    currentIndex,
    error,
    readyCount,
    selectedCount,
    unsavedCount,
    canRun,
    toggleCaseSelection,
    selectAllRunnable,
    deselectAll,
    isCaseSelected,
    isCaseRunnable,
    hasResults,
    runHistory,
    selectedRunId,
    historyLoading,
    selectRun,
    bulkInputRef,
    addEmptyCase,
    addInputFiles,
    handleBulkInputDrop,
    setCaseInputFile,
    setCaseGroundTruth,
    clearCaseGroundTruth,
    saveCase,
    removeCase,
    runBatch,
    clearRunState,
    reloadCases,
    retryBatch,
    selectedModelId,
    setSelectedModelId,
  }
}
