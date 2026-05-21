import { useEffect, useRef, useState } from 'react'
import { LOADING_STEPS } from '../constants/loading'
import { analyzeFloorPlan } from '../services/analyzeApi'
import { downloadAnalysisCSV } from '../utils/csv'

export function useFloorPlanAnalysis() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState(null)
  const [activeRoom, setActiveRoom] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!loading) return
    setLoadingStep(0)
    const t1 = setTimeout(() => setLoadingStep(1), 800)
    const t2 = setTimeout(() => setLoadingStep(2), 2400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [loading])

  const resetAll = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
    setActiveRoom(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileSelect = (selected) => {
    if (!selected) return
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setError(null)
    setResult(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelect(dropped)
  }

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await analyzeFloorPlan(file)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const retryUpload = () => {
    setError(null)
    handleUpload()
  }

  const downloadCSV = () => downloadAnalysisCSV(result)

  return {
    file,
    preview,
    result,
    loading,
    loadingStep,
    loadingSteps: LOADING_STEPS,
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
  }
}
