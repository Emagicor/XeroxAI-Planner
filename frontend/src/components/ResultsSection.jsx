import { useState } from 'react'
import { useReviewState } from '../hooks/useReviewState'
import { downloadServerExport } from '../services/exportApi'
import { copyTableToClipboard, downloadTableCSV } from '../utils/exportTable'
import AnnotatedPagesPanel from './AnnotatedPagesPanel'
import ResultActions from './ResultActions'
import ReviewTable from './ReviewTable'
import SummaryCards from './SummaryCards'
import UnitSelector from './UnitSelector'

export default function ResultsSection({ result, onReset }) {
  const {
    doc,
    unit,
    setUnit,
    visibleRows,
    displayTotal,
    updateRow,
    removeRow,
    activePage,
    activeRoom,
    activeRowId,
    selectRow,
    selectRoomOnPage,
  } = useReviewState(result)
  const [copyDone, setCopyDone] = useState(false)
  const [exportError, setExportError] = useState(null)

  if (!doc) return null

  const legendRooms = doc.rows
    .filter((r) => r.page === activePage && r.eligible && !r.removed)
    .map((r) => ({
      name: r.name,
      roomIndex: r.roomIndex,
      colorIndex: r.colorIndex,
    }))

  const handleCSV = () => {
    setExportError(null)
    downloadTableCSV(doc.rows, unit)
  }

  const handleXLSX = async () => {
    setExportError(null)
    if (doc.jobId) {
      try {
        await downloadServerExport(doc.jobId, unit, 'xlsx')
        return
      } catch (e) {
        setExportError(e.message)
      }
    }
    setExportError('XLSX needs a job_id from the server — re-run analyze, or use CSV.')
  }

  const handleCopy = async () => {
    try {
      await copyTableToClipboard(doc.rows, unit)
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    } catch {
      setExportError('Clipboard access denied')
    }
  }

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-medium text-[#F0EEE8]">Review results</h2>
        <UnitSelector unit={unit} onChange={setUnit} />
      </div>

      <SummaryCards
        doc={doc}
        displayTotal={displayTotal}
        unit={unit}
        roomCount={visibleRows.length}
      />

      {doc.ineligibleList?.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-sm text-amber-200/90">
          <p className="font-medium mb-1">Ineligible pages</p>
          <ul className="list-disc list-inside space-y-0.5">
            {doc.ineligibleList.map((p) => (
              <li key={p.page}>
                Page {p.page}: {p.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 mb-6">
        <AnnotatedPagesPanel
          jobId={doc.jobId}
          annotatedPages={doc.annotatedPages}
          defaultPage={doc.defaultPage}
          activePage={activePage}
          activeRoom={activeRoom}
          legendRooms={legendRooms}
          onPageChange={(page) =>
            selectRow(
              doc.rows.find((r) => r.page === page && r.eligible && !r.removed),
            )
          }
          onSelectRoom={selectRoomOnPage}
        />
      </div>
      <div className="lg:flex-1 min-w-0">
        <p className="text-xs text-[#8B8A82] mb-3">
          Colored overlays match the table swatches. Edit dimensions to
          recompute area; switch units without re-analyzing.
        </p>

        <ReviewTable
          rows={doc.rows}
          unit={unit}
          activeRowId={activeRowId}
          onUpdateRow={updateRow}
          onRemoveRow={removeRow}
          onRowActivate={selectRow}
        />

        {exportError && (
          <p className="mt-2 text-sm text-red-400">{exportError}</p>
        )}

        <ResultActions
          onDownloadCSV={handleCSV}
          onDownloadXLSX={handleXLSX}
          onCopy={handleCopy}
          onReset={onReset}
          copyDone={copyDone}
        />
      </div>
    </section>
  );
}
