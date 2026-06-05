import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createEmptyRoom,
  grandTotalSqft,
  includedRows,
  normalizeAnalyzeResponse,
  recomputeRowArea,
  tableRows,
} from '../utils/analysis'
import { convertAreaFromSqft } from '../utils/units'

function recomputeDoc(prev) {
  return {
    ...prev,
    grandTotalSqft: grandTotalSqft(prev.rows),
  }
}

export function useReviewState(analyzeData) {
  const [unit, setUnit] = useState('sqft')
  const [doc, setDoc] = useState(() =>
    analyzeData ? normalizeAnalyzeResponse(analyzeData) : null,
  )
  const [activePage, setActivePage] = useState(() => doc?.defaultPage ?? 1)
  const [activeRoom, setActiveRoom] = useState(null)
  const [activeRowId, setActiveRowId] = useState(null)

  // Keep review table in sync when the parent passes a new /analyze payload (retry, new file).
  useEffect(() => {
    if (!analyzeData) {
      setDoc(null)
      setActivePage(1)
      setActiveRoom(null)
      setActiveRowId(null)
      return
    }
    const next = normalizeAnalyzeResponse(analyzeData)
    setDoc(next)
    setActivePage(next.defaultPage ?? 1)
    setActiveRoom(null)
    setActiveRowId(null)
  }, [analyzeData])

  const rows = doc?.rows ?? []

  const updateRow = useCallback((id, patch) => {
    setDoc((prev) => {
      if (!prev) return prev
      const nextRows = prev.rows.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, ...patch }
        return recomputeRowArea(updated)
      })
      return recomputeDoc({ ...prev, rows: nextRows })
    })
  }, [])

  const toggleIncluded = useCallback((id, included) => {
    setDoc((prev) => {
      if (!prev) return prev
      const nextRows = prev.rows.map((r) =>
        r.id === id ? { ...r, included } : r,
      )
      return recomputeDoc({ ...prev, rows: nextRows })
    })
  }, [])

  const addRoom = useCallback((page) => {
    setDoc((prev) => {
      if (!prev) return prev
      const targetPage = page ?? activePage ?? prev.defaultPage ?? 1
      const onPage = prev.rows.filter(
        (r) => r.page === targetPage && r.eligible !== false,
      )
      const colorIndex = onPage.length
      const room = createEmptyRoom(targetPage, colorIndex)
      return recomputeDoc({ ...prev, rows: [...prev.rows, room] })
    })
  }, [activePage])

  const selectRow = useCallback((row) => {
    if (!row || !row.eligible) return
    setActiveRowId(row.id)
    setActivePage(row.page)
    setActiveRoom(row.roomIndex ?? null)
  }, [])

  const selectRoomOnPage = useCallback(
    (roomIndex) => {
      setActiveRoom(roomIndex)
      const match = rows.find(
        (r) =>
          r.page === activePage &&
          r.roomIndex === roomIndex &&
          r.eligible &&
          r.included !== false,
      )
      if (match) setActiveRowId(match.id)
    },
    [rows, activePage],
  )

  const displayTotal = useMemo(
    () => convertAreaFromSqft(doc?.grandTotalSqft ?? 0, unit),
    [doc?.grandTotalSqft, unit],
  )

  const visibleRows = useMemo(() => includedRows(rows), [rows])
  const editableRows = useMemo(() => tableRows(rows), [rows])

  return {
    doc,
    unit,
    setUnit,
    rows,
    editableRows,
    visibleRows,
    displayTotal,
    updateRow,
    toggleIncluded,
    addRoom,
    activePage,
    activeRoom,
    activeRowId,
    selectRow,
    selectRoomOnPage,
  }
}
