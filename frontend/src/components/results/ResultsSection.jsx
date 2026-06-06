import { useState } from 'react'
import { useReviewState } from '@/hooks/useReviewState'
import {
  copyTableToClipboard,
  downloadEditedJson,
  downloadTableCSV,
  downloadTableXLSX,
} from '@/utils/exportTable'
import { downloadGroundTruthJson } from '@/utils/testSuite/exportGroundTruth'
import { groupDocByPlan, isMultiPlanDoc } from '@/utils/planSections'
import PlanImagesPanel from '@/components/plan/PlanImagesPanel'
import PlanResultBlock from '@/components/plan/PlanResultBlock'
import PlanTabSwitcher from '@/components/plan/PlanTabSwitcher'
import ResultActions from '@/components/results/ResultActions'
import ReviewTable from '@/components/results/ReviewTable'
import SummaryCards from '@/components/results/SummaryCards'
import UnitSelector from '@/components/results/UnitSelector'
import SectionHeader from '@/components/ui/SectionHeader'
import Badge from '@/components/ui/Badge'
import { scenarioLabel } from '@/utils/scenarios'

export default function ResultsSection({ result, onReset, showJsonDownload = true }) {
  const {
    doc,
    unit,
    setUnit,
    visibleRows,
    displayTotal,
    updateRow,
    toggleIncluded,
    addRoom,
    activePage,
    activeRoom,
    activeRowId,
    selectRow,
    selectPlan,
    selectRoomOnPage,
  } = useReviewState(result)
  const [copyDone, setCopyDone] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [exportingXlsx, setExportingXlsx] = useState(false)

  if (!doc) return null

  const exportBase = doc.filename?.replace(/\.[^.]+$/, '') || 'floor_plan'
  const multiPlan = isMultiPlanDoc(doc)
  const plans = groupDocByPlan(doc)
  const singlePlan = plans[0] ?? null

  const legendRooms = doc.rows
    .filter(
      (r) =>
        r.page === activePage &&
        r.eligible &&
        r.included !== false,
    )
    .map((r) => ({
      name: r.name,
      roomIndex: r.roomIndex,
      colorIndex: r.colorIndex,
    }))

  const handleCSV = () => {
    setExportError(null)
    downloadTableCSV(doc.rows, unit, `${exportBase}_edited.csv`)
  }

  const handleXLSX = async () => {
    setExportError(null)
    setExportingXlsx(true)
    try {
      await downloadTableXLSX(doc.rows, unit, `${exportBase}_edited.xlsx`)
    } catch (e) {
      setExportError(e.message || 'Excel export failed')
    } finally {
      setExportingXlsx(false)
    }
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

  const handleDownloadJSON = () => {
    setExportError(null)
    downloadEditedJson(doc, unit, `${exportBase}_ai_edited.json`)
  }

  const handleDownloadGroundTruth = () => {
    setExportError(null)
    downloadGroundTruthJson(doc, `${exportBase}_ground_truth.json`)
  }

  return (
    <section className="animate-fade-up">
      <SectionHeader
        eyebrow="Results"
        title="Review & export"
        subtitle="Edit room measurements, toggle inclusions, then download in your preferred format."
        action={<UnitSelector unit={unit} onChange={setUnit} />}
      />

      {doc.scenario && (
        <div className="flex flex-wrap items-center gap-2 mb-4 -mt-2">
          <Badge variant="accent">{scenarioLabel(doc.scenario)}</Badge>
          {doc.sourcePageCount != null && doc.totalRegions != null && (
            <span className="text-xs text-muted font-mono">
              {doc.sourcePageCount} page{doc.sourcePageCount !== 1 ? 's' : ''} ·{' '}
              {doc.totalRegions} plan{doc.totalRegions !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <SummaryCards
        doc={doc}
        displayTotal={displayTotal}
        unit={unit}
        roomCount={visibleRows.length}
      />

      {doc.ineligibleList?.length > 0 && (
        <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 text-sm text-amber-200/90">
          <p className="font-medium mb-1">Skipped pages (not floor plans)</p>
          <p className="text-xs text-amber-200/70 mb-2">
            Title sheets, notes, schedules, and elevations are ignored automatically.
            Only floor plan pages are measured and included in totals.
          </p>
          <ul className="space-y-1">
            {doc.ineligibleList.map((p) => (
              <li key={p.page} className="text-xs">
                <span className="font-mono text-amber-100/90">Page {p.page}</span>
                {p.label && (
                  <span className="text-amber-200/60"> · {p.label}</span>
                )}
                <span className="text-amber-200/50"> — {p.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {multiPlan ? (
        <PlanTabSwitcher
          plans={plans}
          activePlan={activePage}
          onSelectPlan={(planNumber) => {
            selectPlan(planNumber)
            const plan = plans.find((p) => p.planNumber === planNumber)
            const target =
              doc.rows.find(
                (r) => r.page === planNumber && r.eligible && r.included !== false,
              ) ?? plan?.rows?.find((r) => r.eligible !== false)
            if (target?.eligible) selectRow(target)
          }}
        >
          {(plan) => (
            <PlanResultBlock
              embedded
              plan={plan}
              jobId={doc.jobId}
              unit={unit}
              activeRowId={activeRowId}
              activeRoom={activePage === plan.planNumber ? activeRoom : null}
              onUpdateRow={updateRow}
              onToggleIncluded={toggleIncluded}
              onAddRoom={addRoom}
              onRowActivate={selectRow}
              onSelectRoom={(roomIndex) => {
                selectRow(
                  plan.rows.find(
                    (r) => r.roomIndex === roomIndex && r.included !== false,
                  ) ?? plan.rows[0],
                )
              }}
            />
          )}
        </PlanTabSwitcher>
      ) : (
        <div className="space-y-6 mb-6">
          {singlePlan && (
            <section className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                Floor plan
              </h3>
              <PlanImagesPanel
                floorLabel={singlePlan.floorLabel}
                clipPreview={singlePlan.clipPreview}
                jobId={doc.jobId}
                planNumber={singlePlan.planNumber}
                annotatedImage={singlePlan.annotatedImage}
                hasAnnotated={singlePlan.hasAnnotated}
                rooms={legendRooms}
                activeRoom={activeRoom}
                onSelectRoom={selectRoomOnPage}
              />
            </section>
          )}
          <section className="space-y-3">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                Room measurements
              </h3>
              <p className="text-xs text-muted mt-1">
                Edit the table below. Grand total and downloads use only checked rows.
              </p>
            </div>
            <ReviewTable
              rows={doc.rows}
              unit={unit}
              activePage={activePage}
              activeRowId={activeRowId}
              onUpdateRow={updateRow}
              onToggleIncluded={toggleIncluded}
              onAddRoom={addRoom}
              onRowActivate={selectRow}
            />
          </section>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-line/60">
        {exportError && (
          <p className="mb-3 text-sm text-red-400">{exportError}</p>
        )}
        <ResultActions
          onDownloadCSV={handleCSV}
          onDownloadXLSX={handleXLSX}
          onDownloadJSON={showJsonDownload ? handleDownloadJSON : undefined}
          onDownloadGroundTruth={handleDownloadGroundTruth}
          onCopy={handleCopy}
          onReset={onReset}
          copyDone={copyDone}
          xlsxLoading={exportingXlsx}
        />
      </div>
    </section>
  )
}
