import { useCallback, useMemo, useState } from 'react'
import {
  activeRows,
  grandTotalSqft,
  normalizeAnalyzeResponse,
  recomputeRowArea,
} from '../utils/analysis'
import { convertAreaFromSqft } from '../utils/units'

export function useReviewState(analyzeData) {
  const [unit, setUnit] = useState('sqft')
  const [doc, setDoc] = useState(() =>
    analyzeData ? normalizeAnalyzeResponse(analyzeData) : null,
  )
  const [activePage, setActivePage] = useState(() => doc?.defaultPage ?? 1)
  const [activeRoom, setActiveRoom] = useState(null)
  const [activeRowId, setActiveRowId] = useState(null)

  const rows = doc?.rows ?? []

  const updateRow = useCallback((id, patch) => {
    setDoc((prev) => {
      if (!prev) return prev
      const nextRows = prev.rows.map((r) => {
        if (r.id !== id) return r
        const updated = { ...r, ...patch }
        return recomputeRowArea(updated)
      })
      return {
        ...prev,
        rows: nextRows,
        grandTotalSqft: grandTotalSqft(nextRows),
      }
    })
  }, [])

  const removeRow = useCallback((id) => {
    setDoc((prev) => {
      if (!prev) return prev
      const nextRows = prev.rows.map((r) =>
        r.id === id ? { ...r, removed: true } : r,
      )
      return {
        ...prev,
        rows: nextRows,
        grandTotalSqft: grandTotalSqft(nextRows),
      }
    })
  }, [])

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
          !r.removed,
      )
      if (match) setActiveRowId(match.id)
    },
    [rows, activePage],
  )

  const displayTotal = useMemo(
    () => convertAreaFromSqft(doc?.grandTotalSqft ?? 0, unit),
    [doc?.grandTotalSqft, unit],
  )

  const visibleRows = useMemo(() => activeRows(rows), [rows])

  return {
    doc,
    unit,
    setUnit,
    rows,
    visibleRows,
    displayTotal,
    updateRow,
    removeRow,
    activePage,
    activeRoom,
    activeRowId,
    selectRow,
    selectRoomOnPage,
  }
}
