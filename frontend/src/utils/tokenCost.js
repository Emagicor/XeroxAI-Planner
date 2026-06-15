/**
 * Token pricing — rates from .env (USD per 1M tokens), costs shown in INR.
 */

const INPUT_RATE = parseFloat(import.meta.env.VITE_TOKEN_INPUT_COST_PER_MILLION_USD ?? '')
const OUTPUT_RATE = parseFloat(import.meta.env.VITE_TOKEN_OUTPUT_COST_PER_MILLION_USD ?? '')

export function getTokenPricingRates() {
  return {
    inputPerMillionUsd: Number.isFinite(INPUT_RATE) ? INPUT_RATE : null,
    outputPerMillionUsd: Number.isFinite(OUTPUT_RATE) ? OUTPUT_RATE : null,
  }
}

export function hasTokenPricingRates() {
  const { inputPerMillionUsd, outputPerMillionUsd } = getTokenPricingRates()
  return inputPerMillionUsd != null && outputPerMillionUsd != null
}

/**
 * Compute USD costs for token counts. Thoughts tokens use the output rate.
 * @returns {{ inputUsd, outputUsd, thoughtsUsd, totalUsd } | null}
 */
export function computeTokenCostsUsd(totals, rates = getTokenPricingRates()) {
  if (!totals || rates.inputPerMillionUsd == null || rates.outputPerMillionUsd == null) {
    return null
  }

  const prompt = totals.prompt_token_count ?? 0
  const output = totals.candidates_token_count ?? 0
  const thoughts = totals.thoughts_token_count ?? 0

  const inputUsd = (prompt / 1_000_000) * rates.inputPerMillionUsd
  const outputUsd = (output / 1_000_000) * rates.outputPerMillionUsd
  const thoughtsUsd = (thoughts / 1_000_000) * rates.outputPerMillionUsd
  const totalUsd = inputUsd + outputUsd + thoughtsUsd

  return { inputUsd, outputUsd, thoughtsUsd, totalUsd }
}

export function usdToInr(usd, inrPerUsd) {
  if (!Number.isFinite(usd) || !Number.isFinite(inrPerUsd)) return null
  return usd * inrPerUsd
}

export function formatInr(amount) {
  if (amount == null || !Number.isFinite(amount)) return '—'
  if (amount < 0.01 && amount > 0) return `₹${amount.toFixed(4)}`
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatUsd(amount) {
  if (amount == null || !Number.isFinite(amount)) return '—'
  if (amount < 0.01 && amount > 0) return `$${amount.toFixed(4)}`
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
}

const EXCHANGE_API = 'https://open.er-api.com/v6/latest/USD'
const CACHE_TTL_MS = 30 * 60 * 1000

let cachedRate = null
let cachedAt = 0

/** Fetch live USD → INR rate (cached ~30 min). */
export async function fetchUsdInrRate() {
  if (cachedRate != null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRate
  }

  const res = await fetch(EXCHANGE_API)
  if (!res.ok) throw new Error('Could not fetch exchange rate')

  const data = await res.json()
  const inr = data?.rates?.INR
  if (!Number.isFinite(inr)) throw new Error('Invalid exchange rate response')

  cachedRate = inr
  cachedAt = Date.now()
  return inr
}
