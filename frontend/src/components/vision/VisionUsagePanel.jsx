import { useUsdInrRate } from '@/hooks/useUsdInrRate'
import {
  computeTokenCostsUsd,
  formatInr,
  formatUsd,
  getTokenPricingRates,
  hasTokenPricingRates,
  usdToInr,
} from '@/utils/tokenCost'
import {
  correctionFieldsSummary,
  formatModelRef,
  formatTokenCount,
  passLabel,
  tokenFieldsFrom,
} from '@/utils/visionUsage'

function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-line/60 bg-surface/40 px-3 py-2.5">
      <p className="stat-label">{label}</p>
      <p className="font-mono text-base font-semibold text-text mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function CostCells({ tokens, inrRate }) {
  const rates = getTokenPricingRates()
  const costs = computeTokenCostsUsd(tokens, rates)

  if (!costs || inrRate == null) {
    return (
      <>
        <td className="px-3 py-2 font-mono text-xs text-muted">—</td>
        <td className="px-3 py-2 font-mono text-xs text-muted">—</td>
        <td className="px-3 py-2 font-mono text-xs text-muted">—</td>
      </>
    )
  }

  const inputInr = usdToInr(costs.inputUsd, inrRate)
  const outputInr = usdToInr(costs.outputUsd + costs.thoughtsUsd, inrRate)
  const totalInr = usdToInr(costs.totalUsd, inrRate)

  return (
    <>
      <td className="px-3 py-2 font-mono text-xs text-emerald-300/90">{formatInr(inputInr)}</td>
      <td className="px-3 py-2 font-mono text-xs text-emerald-300/90">{formatInr(outputInr)}</td>
      <td className="px-3 py-2 font-mono text-xs font-medium text-emerald-200">
        {formatInr(totalInr)}
      </td>
    </>
  )
}

function PassRow({ pass, inrRate, showMode, showCosts }) {
  const { input, output, thoughts, total } = tokenFieldsFrom(pass)

  return (
    <tr className="border-b border-line/30 last:border-0 align-top hover:bg-surface/30">
      <td className="px-3 py-2.5 text-xs">{passLabel(pass)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-muted">
        {pass.provider ?? '—'}
        {pass.model ? ` / ${pass.model}` : ''}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs">{formatTokenCount(input)}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{formatTokenCount(output)}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-muted">
        {formatTokenCount(thoughts)}
      </td>
      <td className="px-3 py-2.5 font-mono text-xs font-medium">{formatTokenCount(total)}</td>
      {showCosts && <CostCells tokens={pass} inrRate={inrRate} />}
      {showMode && (
        <td className="px-3 py-2.5 text-xs text-muted max-w-[10rem]">
          {pass.correction_mode ? (
            <span className="capitalize">{pass.correction_mode.replace('_', ' ')}</span>
          ) : (
            '—'
          )}
        </td>
      )}
      {showMode && (
        <td className="px-3 py-2.5 text-xs text-muted max-w-xs">
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
      )}
    </tr>
  )
}

function PricingFooter({ inrRate, rateLoading, rateError }) {
  const rates = getTokenPricingRates()
  const showCosts = hasTokenPricingRates()

  return (
    <p className="text-[10px] text-muted leading-relaxed">
      Token counts from provider API responses (input, output, thoughts, total).
      {showCosts && (
        <>
          {' '}
          Rates: input {formatUsd(rates.inputPerMillionUsd)}/1M · output{' '}
          {formatUsd(rates.outputPerMillionUsd)}/1M (thoughts billed at output rate).
          {rateLoading && ' · Fetching USD→INR…'}
          {rateError && ` · Exchange rate unavailable (${rateError})`}
          {inrRate != null && !rateLoading && (
            <> · USD→INR: ₹{inrRate.toFixed(2)} (live)</>
          )}
        </>
      )}
      {!showCosts && (
        <>
          {' '}
          Set <code className="text-[10px]">VITE_TOKEN_INPUT_COST_PER_MILLION_USD</code> and{' '}
          <code className="text-[10px]">VITE_TOKEN_OUTPUT_COST_PER_MILLION_USD</code> in{' '}
          <code className="text-[10px]">frontend/.env</code> to show costs.
        </>
      )}
    </p>
  )
}

export default function VisionUsagePanel({ usage, title = 'Token usage & cost', compact = false }) {
  const { rate: inrRate, loading: rateLoading, error: rateError } = useUsdInrRate()

  if (!usage?.passes?.length) {
    return (
      <p className="text-xs text-muted">
        No vision token data — run against a live backend with provider API keys configured.
      </p>
    )
  }

  const totals = usage.totals ?? {}
  const showCosts = hasTokenPricingRates()
  const totalCosts = showCosts ? computeTokenCostsUsd(totals) : null
  const showMode = usage.passes.some((p) => p.correction_mode || p.correction_fields)

  const totalInputInr =
    totalCosts && inrRate != null ? usdToInr(totalCosts.inputUsd, inrRate) : null
  const totalOutputInr =
    totalCosts && inrRate != null
      ? usdToInr(totalCosts.outputUsd + totalCosts.thoughtsUsd, inrRate)
      : null
  const totalCostInr =
    totalCosts && inrRate != null ? usdToInr(totalCosts.totalUsd, inrRate) : null

  return (
    <div className="space-y-4">
      {title && (
        <div>
          <h3 className="text-sm font-medium text-text">{title}</h3>
          <p className="text-xs text-muted mt-0.5">
            {usage.api_calls} API call{usage.api_calls !== 1 ? 's' : ''} · Pass 1:{' '}
            {formatModelRef(usage.models?.extraction)} · Pass 2:{' '}
            {formatModelRef(usage.models?.correction)}
          </p>
        </div>
      )}

      <div
        className={
          compact
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'
            : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'
        }
      >
        <StatTile label="API calls" value={formatTokenCount(usage.api_calls)} />
        <StatTile label="Input tokens" value={formatTokenCount(totals.prompt_token_count)} />
        <StatTile label="Output tokens" value={formatTokenCount(totals.candidates_token_count)} />
        <StatTile
          label="Thoughts tokens"
          value={formatTokenCount(totals.thoughts_token_count)}
        />
        <StatTile label="Total tokens" value={formatTokenCount(totals.total_token_count)} />
      </div>

      {showCosts && (
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Input cost"
            value={totalInputInr != null ? formatInr(totalInputInr) : '—'}
            sub={totalCosts ? formatUsd(totalCosts.inputUsd) : undefined}
          />
          <StatTile
            label="Output cost"
            value={totalOutputInr != null ? formatInr(totalOutputInr) : '—'}
            sub={
              totalCosts
                ? formatUsd(totalCosts.outputUsd + totalCosts.thoughtsUsd)
                : undefined
            }
          />
          <StatTile
            label="Total cost"
            value={totalCostInr != null ? formatInr(totalCostInr) : '—'}
            sub={totalCosts ? formatUsd(totalCosts.totalUsd) : undefined}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line/50">
        <table className="w-full text-sm min-w-[48rem]">
          <thead>
            <tr className="text-left text-muted bg-surface/50 border-b border-line">
              <th className="px-3 py-2.5 font-medium text-xs">Pass</th>
              <th className="px-3 py-2.5 font-medium text-xs">Provider / model</th>
              <th className="px-3 py-2.5 font-medium text-xs">Input</th>
              <th className="px-3 py-2.5 font-medium text-xs">Output</th>
              <th className="px-3 py-2.5 font-medium text-xs">Thoughts</th>
              <th className="px-3 py-2.5 font-medium text-xs">Total</th>
              {showCosts && (
                <>
                  <th className="px-3 py-2.5 font-medium text-xs">Input ₹</th>
                  <th className="px-3 py-2.5 font-medium text-xs">Output ₹</th>
                  <th className="px-3 py-2.5 font-medium text-xs">Total ₹</th>
                </>
              )}
              {showMode && (
                <>
                  <th className="px-3 py-2.5 font-medium text-xs">Mode</th>
                  <th className="px-3 py-2.5 font-medium text-xs">Pass 2 fields</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {usage.passes.map((pass, i) => (
              <PassRow
                key={`${pass.pass}-${pass.pass_kind}-${i}`}
                pass={pass}
                inrRate={inrRate}
                showMode={showMode}
                showCosts={showCosts}
              />
            ))}
          </tbody>
          {usage.totals && (
            <tfoot>
              <tr className="border-t border-line bg-surface/30 font-medium">
                <td className="px-3 py-2.5 text-xs" colSpan={2}>Total</td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  {formatTokenCount(totals.prompt_token_count)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  {formatTokenCount(totals.candidates_token_count)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted">
                  {formatTokenCount(totals.thoughts_token_count)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">
                  {formatTokenCount(totals.total_token_count)}
                </td>
                {showCosts && <CostCells tokens={totals} inrRate={inrRate} />}
                {showMode && <td colSpan={2} />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {usage.pages?.length > 1 && (
        <details className="rounded-lg border border-line/50 bg-surface/20">
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted uppercase tracking-wide">
            Per-page breakdown ({usage.pages.length} pages)
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

      <PricingFooter inrRate={inrRate} rateLoading={rateLoading} rateError={rateError} />
    </div>
  )
}

export function VisionUsageBatchSummary({ batchUsage }) {
  if (!batchUsage) return null

  const { rate: inrRate } = useUsdInrRate()
  const showCosts = hasTokenPricingRates()
  const totalCosts = showCosts ? computeTokenCostsUsd(batchUsage.totals) : null
  const totalInr =
    totalCosts && inrRate != null ? usdToInr(totalCosts.totalUsd, inrRate) : null

  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 overflow-hidden">
      <div className="px-6 py-4 border-b border-accent/15">
        <h3 className="text-sm font-medium text-text">Batch token usage</h3>
        <p className="text-xs text-muted mt-0.5">
          Aggregated across {batchUsage.caseCount} case{batchUsage.caseCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total API calls" value={formatTokenCount(batchUsage.apiCalls)} />
        <StatTile
          label="Input tokens"
          value={formatTokenCount(batchUsage.totals?.prompt_token_count)}
        />
        <StatTile
          label="Output tokens"
          value={formatTokenCount(batchUsage.totals?.candidates_token_count)}
        />
        <StatTile
          label="Total tokens"
          value={formatTokenCount(batchUsage.totals?.total_token_count)}
        />
        {showCosts && totalInr != null && (
          <StatTile
            label="Batch total cost"
            value={formatInr(totalInr)}
            sub={totalCosts ? formatUsd(totalCosts.totalUsd) : undefined}
          />
        )}
      </div>
    </div>
  )
}
