/**
 * Vision API usage helpers — token counts from provider responses, never estimated.
 */

/** @typedef {{ prompt_token_count?: number|null, candidates_token_count?: number|null, thoughts_token_count?: number|null, total_token_count?: number|null }} TokenTotals */

/** @typedef {{ pass?: number, pass_kind?: string, provider?: string, model?: string|null, page_number?: number|null, correction_mode?: string|null, correction_fields?: object|null, prompt_token_count?: number|null, candidates_token_count?: number|null, thoughts_token_count?: number|null, total_token_count?: number|null }} VisionPass */

/** @typedef {{ api_calls?: number, passes?: VisionPass[], pages?: object[], totals?: TokenTotals, models?: { extraction?: { provider?: string|null, model?: string|null }, correction?: { provider?: string|null, model?: string|null } } }} VisionUsage */

export function formatTokenCount(value) {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString()
}

export function getVisionUsage(source) {
  if (!source) return null
  if (source.vision_usage) return source.vision_usage
  if (source.raw?.vision_usage) return source.raw.vision_usage
  return null
}

export function hasVisionUsage(source) {
  const usage = getVisionUsage(source)
  return Boolean(usage && (usage.api_calls > 0 || usage.totals?.total_token_count != null))
}

/** Sum token fields across usage objects (real API values only). */
export function sumTokenTotals(usages) {
  /** @type {TokenTotals} */
  const out = {
    prompt_token_count: null,
    candidates_token_count: null,
    thoughts_token_count: null,
    total_token_count: null,
  }

  for (const usage of usages) {
    const totals = usage?.totals
    if (!totals) continue
    for (const key of Object.keys(out)) {
      const val = totals[key]
      if (val == null || !Number.isFinite(val)) continue
      out[key] = (out[key] ?? 0) + val
    }
  }

  return out
}

export function aggregateBatchVisionUsage(results) {
  const usages = results
    .map((row) => getVisionUsage(row.aiResult))
    .filter(Boolean)

  if (!usages.length) return null

  const totals = sumTokenTotals(usages)
  const apiCalls = usages.reduce((sum, u) => sum + (u.api_calls ?? 0), 0)

  const extractionModels = new Set()
  const correctionModels = new Set()
  for (const usage of usages) {
    const ext = usage.models?.extraction
    const corr = usage.models?.correction
    if (ext?.model) extractionModels.add(`${ext.provider ?? '?'}:${ext.model}`)
    if (corr?.model) correctionModels.add(`${corr.provider ?? '?'}:${corr.model}`)
  }

  return {
    caseCount: usages.length,
    apiCalls,
    totals,
    extractionModels: [...extractionModels],
    correctionModels: [...correctionModels],
  }
}

export function passLabel(pass) {
  if (!pass) return '—'
  const num = pass.pass ?? pass.pass_number
  const kind = pass.pass_kind === 'correction' ? 'Pass 2 · correction' : 'Pass 1 · extraction'
  return num ? `${kind} (#${num})` : kind
}

export function formatModelRef(ref) {
  if (!ref?.model && !ref?.provider) return '—'
  if (ref.model && ref.provider) return `${ref.provider} / ${ref.model}`
  return ref.model ?? ref.provider ?? '—'
}

export function correctionFieldsSummary(fields) {
  if (!fields || typeof fields !== 'object') return null
  if (fields.mode === 'full_fallback') {
    return `Full fallback (pass-1 raw text, ${fields.pass1_text_length ?? '?'} chars)`
  }
  const parts = []
  if (fields.scan_for_missed_rooms) parts.push('scan missed rooms')
  const verifyCount = Array.isArray(fields.rooms_to_verify) ? fields.rooms_to_verify.length : 0
  if (verifyCount) parts.push(`${verifyCount} room(s) to verify`)
  if (fields.floor_identification) parts.push('floor identification')
  if (Array.isArray(fields.existing_room_names) && fields.existing_room_names.length) {
    parts.push(`${fields.existing_room_names.length} existing names`)
  }
  return parts.length ? parts.join(' · ') : 'Selective correction payload'
}

/** @deprecated use separate token columns in VisionUsagePanel */
export function tokenBreakdownLine(totals) {
  if (!totals) return '—'
  const parts = [
    `input ${formatTokenCount(totals.prompt_token_count)}`,
    `output ${formatTokenCount(totals.candidates_token_count)}`,
  ]
  if (totals.thoughts_token_count != null) {
    parts.push(`thoughts ${formatTokenCount(totals.thoughts_token_count)}`)
  }
  parts.push(`total ${formatTokenCount(totals.total_token_count)}`)
  return parts.join(' · ')
}

/** Normalize pass or totals object to consistent token field names. */
export function tokenFieldsFrom(obj) {
  return {
    input: obj?.prompt_token_count,
    output: obj?.candidates_token_count,
    thoughts: obj?.thoughts_token_count,
    total: obj?.total_token_count,
  }
}
