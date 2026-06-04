import { useMemo } from 'react'
import { evaluateAgainstGroundTruth } from '../../utils/testSuite/compare'

function pct(n) {
  return `${(n * 100).toFixed(1)}%`
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="bg-card border border-line rounded-lg p-4">
      <p className="text-xs text-[#8B8A82] mb-1">{label}</p>
      <p className="font-mono text-xl font-semibold text-[#F0EEE8]">{value}</p>
      {hint && <p className="text-[10px] text-[#8B8A82] mt-1">{hint}</p>}
    </div>
  )
}

function ConfusionMatrixCard({ title, tp, fp, fn }) {
  return (
    <div className="bg-card border border-line rounded-lg p-4">
      <p className="text-sm text-[#8B8A82] mb-4">{title}</p>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div />
        <div className="text-[#8B8A82] font-medium">Pred +</div>
        <div className="text-[#8B8A82] font-medium">Pred -</div>

        <div className="text-[#8B8A82] font-medium">GT +</div>

        <div className="rounded-md bg-emerald-500/15 border border-emerald-500/30 p-3">
          <div className="text-xs text-emerald-300">TP</div>
          <div className="font-mono text-xl">{tp}</div>
        </div>

        <div className="rounded-md bg-red-500/15 border border-red-500/30 p-3">
          <div className="text-xs text-red-300">FN</div>
          <div className="font-mono text-xl">{fn}</div>
        </div>

        <div className="text-[#8B8A82] font-medium">GT -</div>

        <div className="rounded-md bg-amber-500/15 border border-amber-500/30 p-3">
          <div className="text-xs text-amber-200">FP</div>
          <div className="font-mono text-xl">{fp}</div>
        </div>

        <div className="rounded-md bg-surface border border-line p-3">
          <div className="text-xs text-[#8B8A82]">TN</div>
          <div className="font-mono text-xl">—</div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-[#8B8A82]">
        TN is undefined for room extraction tasks.
      </p>
    </div>
  );
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

export default function TestSuiteMetrics({ groundTruth, aiResult, evalError }) {
  const evaluation = useMemo(() => {
    if (!groundTruth || !aiResult) return null
    try {
      return evaluateAgainstGroundTruth(groundTruth, aiResult)
    } catch {
      return null
    }
  }, [groundTruth, aiResult])

  if (evalError) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-950/20 text-red-300 text-sm">
        {evalError}
      </div>
    )
  }

  if (!groundTruth) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-line bg-card/50 text-[#8B8A82] text-sm">
        Upload a ground truth JSON file to see evaluation metrics.
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200/90 text-sm">
        Could not evaluate — ensure the AI run completed and ground truth has rooms.
      </div>
    )
  }

  const m = evaluation

  return (
    <section className="mb-8">
      <h3 className="text-lg font-medium text-[#F0EEE8] mb-1">
        Test suite evaluation
      </h3>
      <p className="text-xs text-[#8B8A82] mb-4">
        Compared {m.gtCount} ground-truth rooms vs {m.aiCount} AI rooms (±0.5 ft
        on dimensions; length/width swap allowed).
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard
          label="Room Recall"
          value={pct(m.roomRecall)}
          hint={`${m.truePositives} of ${m.gtCount} GT rooms found`}
        />

        <MetricCard
          label="Room Precision"
          value={pct(m.roomPrecision)}
          hint={`${m.truePositives} correct of ${m.aiCount} AI rooms`}
        />

        <MetricCard
          label="Room F1"
          value={pct(m.roomF1)}
          hint="Detection quality"
        />

        <MetricCard label="Room Accuracy" value={pct(m.roomAccuracy)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <MetricCard
          label="Dimension Precision"
          value={pct(m.dimensionPrecision)}
          hint={`${m.dimensionTP} correct dimensions`}
        />

        <MetricCard
          label="Dimension Recall"
          value={pct(m.dimensionRecall)}
          hint={`${m.dimensionTP}/${m.dimensionTP + m.dimensionFN}`}
        />

        <MetricCard
          label="Dimension F1"
          value={pct(m.dimensionF1)}
          hint="Dimension extraction quality"
        />

        <MetricCard
          label="Dimension Accuracy"
          value={pct(m.dimensionAccuracy)}
          hint={`${m.dimensionTP} of ${m.gtCount} GT rooms`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <MetricCard
          label="Area Accuracy"
          value={pct(m.areaAccuracy)}
          hint={`${m.areaCorrect} rooms with correct area`}
        />

        <ConfusionMatrixCard
          title="Room Detection Matrix"
          tp={m.truePositives}
          fp={m.falsePositives}
          fn={m.falseNegatives}
        />

        <ConfusionMatrixCard
          title="Dimension Extraction Matrix"
          tp={m.dimensionTP}
          fp={m.dimensionFP}
          fn={m.dimensionFN}
        />
      </div>

      <div className="bg-card border border-line rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <p className="text-sm font-medium text-[#F0EEE8]">
            Per-room comparison
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#8B8A82] border-b border-line">
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Page</th>
                <th className="px-3 py-2">Ground truth</th>
                <th className="px-3 py-2">GT dimensions</th>
                <th className="px-3 py-2">AI name</th>
                <th className="px-3 py-2">AI dimensions</th>
                <th className="px-3 py-2">Dims OK</th>
              </tr>
            </thead>
            <tbody>
              {m.pairs.map((row, i) => (
                <tr key={i} className="border-b border-line/40">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs border capitalize ${statusBadge(row.status)}`}
                    >
                      {row.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[#8B8A82]">
                    {row.gt?.page ?? row.ai?.page ?? "—"}
                  </td>
                  <td className="px-3 py-2">{row.gt?.name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.gt?.lengthFt != null && row.gt?.widthFt != null
                      ? `${row.gt.lengthFt} × ${row.gt.widthFt} ft`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{row.ai?.name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {row.ai?.lengthFt != null && row.ai?.widthFt != null
                      ? `${row.ai.lengthFt} × ${row.ai.widthFt} ft`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.dimensionsMatch ? (
                      <span className="text-emerald-400">Yes</span>
                    ) : (
                      <span className="text-[#8B8A82]">No</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
