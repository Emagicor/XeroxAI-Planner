import { useMemo, useState } from 'react'
import {
  aggregateEvaluations,
  evaluateAgainstGroundTruth,
  splitEvaluationByPlan,
} from '@/utils/testSuite/compare'
import { extractPlanSectionsFromAnalyze, isMultiPlanAnalyze } from '@/utils/planSections'
import { scenarioLabel } from '@/utils/scenarios'
import PlanImagesPanel from '@/components/plan/PlanImagesPanel'
import PlanTabSwitcher from '@/components/plan/PlanTabSwitcher'
import Button from '@/components/ui/Button'

function pct(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function ft(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(2)} ft`
}

function ftSq(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(3)} ft²`
}

function MetricTile({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-line/60 bg-surface/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono text-base font-semibold text-text mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function SummaryStat({ label, value, accent }) {
  return (
    <div className="text-center px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className={`font-mono text-2xl font-semibold ${accent ?? 'text-text'}`}>
        {value}
      </p>
    </div>
  )
}

function ConfusionMini({ tp, fp, fn }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2 py-2">
        <p className="text-emerald-400/80">TP</p>
        <p className="font-mono text-lg text-emerald-300">{tp}</p>
      </div>
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 px-2 py-2">
        <p className="text-amber-300/80">FP</p>
        <p className="font-mono text-lg text-amber-200">{fp}</p>
      </div>
      <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-2 py-2">
        <p className="text-red-400/80">FN</p>
        <p className="font-mono text-lg text-red-300">{fn}</p>
      </div>
    </div>
  )
}

function statusBadge(status) {
  const map = {
    match: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    name_only: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    missed: 'bg-red-500/15 text-red-300 border-red-500/30',
    extra: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
    weak: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  }
  return map[status] ?? map.weak
}

function caseOutcome(row) {
  if (row.error) return { label: 'Analysis failed', tone: 'border-red-500/30 bg-red-950/20 text-red-300' }
  if (row.evalError) return { label: 'Eval failed', tone: 'border-amber-500/30 bg-amber-950/20 text-amber-200' }
  const m = row.evaluation
  if (!m) return { label: 'No data', tone: 'border-line bg-surface/40 text-muted' }
  const score = m.roomF1 ?? 0
  if (score >= 0.85) return { label: 'Pass', tone: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' }
  if (score >= 0.6) return { label: 'Partial', tone: 'border-amber-500/30 bg-amber-950/20 text-amber-200' }
  return { label: 'Needs review', tone: 'border-red-500/30 bg-red-950/20 text-red-300' }
}

function PerRoomTable({ evaluation, hidePageColumn = false }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted bg-surface/50 border-b border-line">
            <th className="px-3 py-2.5 font-medium">Status</th>
            {!hidePageColumn && (
              <th className="px-3 py-2.5 font-medium">Page</th>
            )}
            <th className="px-3 py-2.5 font-medium">Ground truth</th>
            <th className="px-3 py-2.5 font-medium">GT dims</th>
            <th className="px-3 py-2.5 font-medium">AI name</th>
            <th className="px-3 py-2.5 font-medium">AI dims</th>
            <th className="px-3 py-2.5 font-medium">Dim error</th>
            <th className="px-3 py-2.5 font-medium">Area</th>
          </tr>
        </thead>
        <tbody>
          {evaluation.pairs.map((row, i) => {
            const gtPair =
              row.gt?.lengthFt != null && row.gt?.widthFt != null
                ? [row.gt.lengthFt, row.gt.widthFt]
                : null
            const aiPair =
              row.ai?.lengthFt != null && row.ai?.widthFt != null
                ? [row.ai.lengthFt, row.ai.widthFt]
                : null
            let dimError = '—'
            if (gtPair && aiPair) {
              const sortedGt = [Math.min(...gtPair), Math.max(...gtPair)]
              const sortedAi = [Math.min(...aiPair), Math.max(...aiPair)]
              const err = Math.sqrt(
                ((sortedGt[0] - sortedAi[0]) ** 2 + (sortedGt[1] - sortedAi[1]) ** 2) / 2,
              )
              dimError = `${err.toFixed(2)} ft`
            }

            return (
              <tr key={i} className="border-b border-line/30 last:border-0">
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs border capitalize ${statusBadge(row.status)}`}
                  >
                    {row.status.replace('_', ' ')}
                  </span>
                </td>
                {!hidePageColumn && (
                  <td className="px-3 py-2 font-mono text-muted">
                    {row.gt?.page ?? row.ai?.page ?? '—'}
                  </td>
                )}
                <td className="px-3 py-2">{row.gt?.name ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {gtPair ? `${gtPair[0]}×${gtPair[1]} ft` : '—'}
                </td>
                <td className="px-3 py-2">{row.ai?.name ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {aiPair ? `${aiPair[0]}×${aiPair[1]} ft` : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{dimError}</td>
                <td className="px-3 py-2">
                  {row.areaMatch ? (
                    <span className="text-emerald-400 text-xs">Match</span>
                  ) : (
                    <span className="text-muted text-xs">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PlanCaseContent({ plan, planEval }) {
  const metrics = planEval?.metrics

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        {plan.roomCount} AI room{plan.roomCount !== 1 ? 's' : ''}
        {metrics && (
          <span className="font-mono ml-2">
            F1 {pct(metrics.roomF1)} · {metrics.gtCount} GT / {metrics.aiCount} AI
          </span>
        )}
      </p>

      <section className="space-y-3">
        <h5 className="text-[10px] font-medium uppercase tracking-wide text-muted">
          Floor plan visuals
        </h5>
        <PlanImagesPanel
          floorLabel={plan.floorLabel}
          clipPreview={plan.clipPreview}
          planNumber={plan.planNumber}
          annotatedImage={plan.annotatedImage}
          hasAnnotated={plan.hasAnnotated}
          rooms={[]}
          expandable={false}
        />
      </section>

      <section className="space-y-3">
        <h5 className="text-[10px] font-medium uppercase tracking-wide text-muted">
          Room comparison
        </h5>
        {planEval?.pairs?.length > 0 ? (
          <PerRoomTable evaluation={{ pairs: planEval.pairs }} hidePageColumn />
        ) : (
          <p className="text-xs text-muted">No room pairs for this plan.</p>
        )}
      </section>
    </div>
  )
}

function CasePlanTabs({ planSections, planEvals }) {
  const [activePlan, setActivePlan] = useState(planSections[0]?.planNumber ?? 1)

  return (
    <PlanTabSwitcher
      plans={planSections}
      activePlan={activePlan}
      onSelectPlan={setActivePlan}
    >
      {(plan) => {
        const planEval = planEvals.find((pe) => pe.planPage === plan.planNumber)
        return <PlanCaseContent plan={plan} planEval={planEval} />
      }}
    </PlanTabSwitcher>
  )
}

function CaseResultCard({ index, row, expanded, onToggle }) {
  const m = row.evaluation
  const outcome = caseOutcome(row)
  const isPdf = row.inputFileName?.toLowerCase().endsWith('.pdf')
  const planSections = row.aiResult ? extractPlanSectionsFromAnalyze(row.aiResult) : []
  const multiPlan = isMultiPlanAnalyze(row.aiResult)
  const planEvals =
    m && multiPlan
      ? splitEvaluationByPlan(m, planSections.map((p) => p.planNumber))
      : []

  const summaryLine = m
    ? `F1 ${pct(m.roomF1)} · RMSE ${ft(m.dimensionRMSE)} · ${m.gtCount} GT / ${m.aiCount} AI rooms`
    : row.error || row.evalError || 'No metrics available'

  return (
    <div className="rounded-xl border border-line bg-card overflow-hidden transition-shadow hover:shadow-lg hover:shadow-black/10">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 sm:px-5 py-4 flex items-start gap-4 hover:bg-surface/30 transition-colors"
      >
        {row.preview && !isPdf ? (
          <img
            src={row.preview}
            alt=""
            className="w-12 h-12 object-cover rounded-lg border border-line shrink-0 hidden sm:block"
          />
        ) : (
          <div className="w-12 h-12 rounded-lg border border-line bg-surface flex items-center justify-center shrink-0 hidden sm:block">
            <span className="text-[10px] font-mono text-accent">{isPdf ? 'PDF' : 'IMG'}</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted">Case {index + 1}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${outcome.tone}`}>
              {outcome.label}
            </span>
          </div>
          <p className="text-sm font-medium text-text truncate" title={row.inputFileName}>
            {row.inputFileName}
          </p>
          <p className="text-xs text-muted truncate mt-0.5" title={row.groundTruthFileName}>
            Ground truth: {row.groundTruthFileName}
          </p>
          {row.aiResult?.scenario && (
            <p className="text-[10px] text-accent/80 mt-1">
              {scenarioLabel(row.aiResult.scenario)}
              {row.aiResult.total_regions != null && (
                <span className="font-mono text-muted ml-2">
                  {row.aiResult.total_regions} plan{row.aiResult.total_regions !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          )}
          <p className="text-xs font-mono text-muted mt-2">{summaryLine}</p>
        </div>

        <div className="shrink-0 flex items-center gap-2 pt-1">
          {m && (
            <div className="hidden md:grid grid-cols-3 gap-3 mr-2">
              <div className="text-right">
                <p className="text-[10px] text-muted">Precision</p>
                <p className="font-mono text-sm text-text">{pct(m.roomPrecision)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted">Recall</p>
                <p className="font-mono text-sm text-text">{pct(m.roomRecall)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted">Dim MAE</p>
                <p className="font-mono text-sm text-text">{ft(m.dimensionMAE)}</p>
              </div>
            </div>
          )}
          <svg
            className={`w-5 h-5 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 sm:px-5 pb-5 border-t border-line/50 bg-surface/20">
          {(row.error || row.evalError) && (
            <div className="mt-4 p-3 rounded-lg border border-red-500/25 bg-red-950/20 text-red-300 text-sm">
              {row.error || row.evalError}
            </div>
          )}

          {m && (
            <>
              {multiPlan && planSections.length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
                    Per-plan results
                  </p>
                  <CasePlanTabs planSections={planSections} planEvals={planEvals} />
                </div>
              ) : (
                <div className="mt-4 space-y-6">
                  {(planSections[0]?.clipPreview || planSections[0]?.annotatedImage) && (
                    <section className="space-y-3">
                      <p className="text-xs font-medium text-muted uppercase tracking-wide">
                        Floor plan visuals
                      </p>
                      <PlanImagesPanel
                        floorLabel={planSections[0].floorLabel}
                        clipPreview={planSections[0].clipPreview}
                        planNumber={planSections[0].planNumber}
                        annotatedImage={planSections[0].annotatedImage}
                        hasAnnotated={planSections[0].hasAnnotated}
                        rooms={[]}
                        expandable={false}
                      />
                    </section>
                  )}
                  <section className="space-y-3">
                    <p className="text-xs font-medium text-muted uppercase tracking-wide">
                      Room comparison
                    </p>
                    <PerRoomTable evaluation={m} />
                  </section>
                </div>
              )}

              <details className="mt-6 rounded-lg border border-line/50 bg-surface/30">
                <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-muted uppercase tracking-wide hover:text-text">
                  Case metrics (precision, recall, dimensions)
                </summary>
                <div className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    <MetricTile label="Room P" value={pct(m.roomPrecision)} />
                    <MetricTile label="Room R" value={pct(m.roomRecall)} />
                    <MetricTile label="Room F1" value={pct(m.roomF1)} />
                    <MetricTile label="Area Acc" value={pct(m.areaAccuracy)} />
                    <MetricTile label="Dim MSE" value={ftSq(m.dimensionMSE)} />
                    <MetricTile label="Dim RMSE" value={ft(m.dimensionRMSE)} />
                    <MetricTile label="Dim MAE" value={ft(m.dimensionMAE)} />
                    <MetricTile
                      label="Rooms"
                      value={`${m.gtCount} / ${m.aiCount}`}
                      sub="GT / AI"
                    />
                  </div>
                  <div className="max-w-xs">
                    <p className="text-[10px] uppercase tracking-wide text-muted mb-2">
                      Detection matrix
                    </p>
                    <ConfusionMini tp={m.truePositives} fp={m.falsePositives} fn={m.falseNegatives} />
                  </div>
                </div>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function TestSuiteMetrics({ results, onNewBatch }) {
  const [expandedIds, setExpandedIds] = useState(new Set())

  const aggregate = useMemo(() => {
    const evals = results.filter((r) => r.evaluation).map((r) => r.evaluation)
    return aggregateEvaluations(evals)
  }, [results])

  const passedCount = results.filter((r) => {
    const o = caseOutcome(r)
    return o.label === 'Pass'
  }).length

  const toggleCase = (caseId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(caseId)) next.delete(caseId)
      else next.add(caseId)
      return next
    })
  }

  const expandAll = () => {
    setExpandedIds(new Set(results.map((r) => r.caseId ?? r.inputFileName)))
  }

  const collapseAll = () => setExpandedIds(new Set())

  if (!results.length) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-line bg-card/50 text-muted text-sm text-center">
        Run the batch to see evaluation metrics.
      </div>
    )
  }

  return (
    <section className="mb-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-medium text-text">Test suite report</h2>
          <p className="text-sm text-muted mt-1">
            {results.length} cases evaluated · expand any row for full metrics and room-level
            comparison
          </p>
        </div>
        {onNewBatch && (
          <Button variant="secondary" size="sm" onClick={onNewBatch} className="shrink-0">
            Run new batch
          </Button>
        )}
      </div>

      {aggregate && (
        <div className="rounded-2xl border border-line bg-gradient-to-br from-card/90 to-surface/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-line/60 bg-surface/20">
            <h3 className="text-sm font-medium text-text">Overall summary</h3>
            <p className="text-xs text-muted mt-0.5">
              Pooled metrics across all {aggregate.caseCount} test cases
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-line/40 border-b border-line/40">
            <SummaryStat label="Room recall" value={pct(aggregate.roomRecall)} accent="text-emerald-400" />
            <SummaryStat label="Room precision" value={pct(aggregate.roomPrecision)} accent="text-emerald-400" />
            <SummaryStat label="Room F1" value={pct(aggregate.roomF1)} />
            <SummaryStat label="Cases passed" value={`${passedCount}/${results.length}`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line/30">
            <div className="bg-card/80 px-4 py-4">
              <MetricTile
                label="Dimension RMSE"
                value={ft(aggregate.dimensionRMSE)}
                sub={`${aggregate.dimensionSampleCount} values`}
              />
            </div>
            <div className="bg-card/80 px-4 py-4">
              <MetricTile label="Dimension MAE" value={ft(aggregate.dimensionMAE)} />
            </div>
            <div className="bg-card/80 px-4 py-4">
              <MetricTile label="Dimension MSE" value={ftSq(aggregate.dimensionMSE)} />
            </div>
            <div className="bg-card/80 px-4 py-4">
              <MetricTile label="Area accuracy" value={pct(aggregate.areaAccuracy)} />
            </div>
          </div>

          <div className="px-6 py-4 grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">
                Pooled detection matrix
              </p>
              <ConfusionMini
                tp={aggregate.truePositives}
                fp={aggregate.falsePositives}
                fn={aggregate.falseNegatives}
              />
            </div>
            <div className="flex flex-col justify-center text-sm text-muted space-y-1">
              <p>
                <span className="text-text font-mono">{aggregate.truePositives}</span> true
                positives across all cases
              </p>
              <p>
                <span className="text-amber-200 font-mono">{aggregate.falsePositives}</span> false
                positives ·{' '}
                <span className="text-red-300 font-mono">{aggregate.falseNegatives}</span> false
                negatives
              </p>
              <p>
                <span className="text-text font-mono">{aggregate.missingDimensionPairs}</span>{' '}
                matched rooms with missing dimensions
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-text">Individual test cases</h3>
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={expandAll} className="text-accent hover:underline">
              Expand all
            </button>
            <button type="button" onClick={collapseAll} className="text-muted hover:text-text">
              Collapse all
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {results.map((row, i) => {
            const id = row.caseId ?? `${row.inputFileName}-${i}`
            return (
              <CaseResultCard
                key={id}
                index={i}
                row={row}
                expanded={expandedIds.has(id)}
                onToggle={() => toggleCase(id)}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function TestSuiteSingleMetrics({ groundTruth, aiResult, evalError }) {
  const evaluation = useMemo(() => {
    if (!groundTruth || !aiResult) return null
    try {
      return evaluateAgainstGroundTruth(groundTruth, aiResult)
    } catch {
      return null
    }
  }, [groundTruth, aiResult])

  const results = useMemo(() => {
    if (!evaluation) return []
    return [
      {
        caseId: 'session',
        inputFileName: 'Current session',
        groundTruthFileName: 'Ground truth',
        evaluation,
        evalError: null,
        error: null,
      },
    ]
  }, [evaluation])

  if (!groundTruth) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-line bg-card/50 text-muted text-sm">
        Upload a ground truth JSON file to see evaluation metrics.
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200/90 text-sm">
        {evalError ||
          'Could not evaluate — ensure the AI run completed and ground truth has rooms.'}
      </div>
    )
  }

  return <TestSuiteMetrics results={results} />
}
