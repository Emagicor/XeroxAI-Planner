import {
  correctionFieldsSummary,
  formatModelRef,
  formatTokenCount,
  getVisionUsage,
  passLabel,
  tokenBreakdownLine,
} from '@/utils/testSuite/visionUsage'

function TokenTile({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-line/60 bg-surface/40 px-3 py-2.5">
      <p className="stat-label">{label}</p>
      <p className="font-mono text-base font-semibold text-text mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function PassRow({ pass }) {
  return (
    <tr className="border-b border-line/30 last:border-0 align-top">
      <td className="px-3 py-2 text-xs">{passLabel(pass)}</td>
      <td className="px-3 py-2 font-mono text-xs">
        {pass.provider ?? '—'}
        {pass.model ? ` / ${pass.model}` : ''}
      </td>
      <td className="px-3 py-2 font-mono text-xs text-muted">{tokenBreakdownLine(pass)}</td>
      <td className="px-3 py-2 text-xs text-muted">
        {pass.correction_mode ? (
          <span className="capitalize">{pass.correction_mode.replace('_', ' ')}</span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2 text-xs text-muted max-w-xs">
        {pass.correction_fields ? (
          <details>
            <summary className="cursor-pointer hover:text-text">
              {correctionFieldsSummary(pass.correction_fields)}
            </summary>
            <pre className="mt-2 p-2 rounded bg-surface/60 border border-line/40 text-[10px] font-mono overflow-x-auto max-h-48">
              {JSON.stringify(pass.correction_fields, null, 2)}
            </pre>
          </details>
        ) : (
          '—'
        )}
      </td>
    </tr>
  )
}

function VisionUsageTable({ usage }) {
  if (!usage?.passes?.length) {
    return (
      <p className="text-xs text-muted">
        No vision token data — run against a live backend with provider API keys configured.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <TokenTile label="API calls" value={formatTokenCount(usage.api_calls)} />
        <TokenTile
          label="Total tokens"
          value={formatTokenCount(usage.totals?.total_token_count)}
          sub={tokenBreakdownLine(usage.totals)}
        />
        <TokenTile
          label="Pass 1 model"
          value={formatModelRef(usage.models?.extraction)}
        />
        <TokenTile
          label="Pass 2 model"
          value={formatModelRef(usage.models?.correction)}
          sub="Correction pass (when run)"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-line/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted bg-surface/50 border-b border-line">
              <th className="px-3 py-2.5 font-medium text-xs">Pass</th>
              <th className="px-3 py-2.5 font-medium text-xs">Provider / model</th>
              <th className="px-3 py-2.5 font-medium text-xs">Tokens (API)</th>
              <th className="px-3 py-2.5 font-medium text-xs">Mode</th>
              <th className="px-3 py-2.5 font-medium text-xs">Pass 2 fields sent</th>
            </tr>
          </thead>
          <tbody>
            {usage.passes.map((pass, i) => (
              <PassRow key={`${pass.pass}-${pass.pass_kind}-${i}`} pass={pass} />
            ))}
          </tbody>
        </table>
      </div>

      {usage.pages?.length > 1 && (
        <details className="rounded-lg border border-line/50 bg-surface/20">
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted uppercase tracking-wide">
            Per-page token breakdown ({usage.pages.length} pages)
          </summary>
          <ul className="px-4 pb-3 space-y-1 text-xs font-mono text-muted">
            {usage.pages.map((page) => (
              <li key={page.page_number}>
                Page {page.page_number}: {formatTokenCount(page.totals?.total_token_count)} tokens
                {' · '}
                {page.api_calls} call{page.api_calls !== 1 ? 's' : ''}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[10px] text-muted">
        Token counts are read directly from provider API responses (prompt + output
        {usage.totals?.thoughts_token_count != null ? ' + thoughts' : ''}). No client-side estimates.
      </p>
    </div>
  )
}

export function TestSuiteBatchVisionSummary({ batchUsage }) {
  if (!batchUsage) return null

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-accent/15">
        <h3 className="text-sm font-medium text-text">Batch token usage</h3>
        <p className="text-xs text-muted mt-0.5">
          Aggregated across {batchUsage.caseCount} case{batchUsage.caseCount !== 1 ? 's' : ''} with
          real API data
        </p>
      </div>
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <TokenTile label="Total API calls" value={formatTokenCount(batchUsage.apiCalls)} />
        <TokenTile
          label="Batch total tokens"
          value={formatTokenCount(batchUsage.totals.total_token_count)}
          sub={tokenBreakdownLine(batchUsage.totals)}
        />
        <TokenTile
          label="Pass 1 models"
          value={batchUsage.extractionModels.length || '—'}
          sub={batchUsage.extractionModels.join(', ') || undefined}
        />
        <TokenTile
          label="Pass 2 models"
          value={batchUsage.correctionModels.length || '—'}
          sub={batchUsage.correctionModels.join(', ') || undefined}
        />
      </div>
    </div>
  )
}

export function TestSuiteCaseVisionUsage({ aiResult }) {
  const usage = getVisionUsage(aiResult)
  if (!usage) return null

  return (
    <section className="mt-6 space-y-3">
      <h5 className="text-xs font-medium uppercase tracking-wide text-muted">
        Vision tokens &amp; models
      </h5>
      <VisionUsageTable usage={usage} />
    </section>
  )
}

export default VisionUsageTable
