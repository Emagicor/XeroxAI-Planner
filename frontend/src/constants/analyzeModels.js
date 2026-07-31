/**
 * Vision models offered on the Analyze tab.
 *
 * Sent to POST /analyze and /analyze/stream as vision_provider / vision_model and
 * vision_correction_provider / vision_correction_model.
 *
 * Pass 1 (extraction) runs FLOOR_PLAN_PROMPT. Pass 2 (correction) re-checks low-confidence
 * rooms with CORRECTION_PROMPT. Leaving pass 2 on "Same as pass 1" sends no correction
 * override, so the backend falls back the way it always has — see
 * providers/vision/factory.py::_resolve_correction_provider_model.
 *
 * Adding an entry here is enough to surface it; the backend resolves any provider it
 * implements, provided the matching API key is set in backend2.0/.env.
 */

export const ANALYZE_MODELS = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    description: 'Recommended — stable quota, proven on architectural plans.',
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    provider: 'gemini',
    model: 'gemini-3.5-flash',
    description: 'Newer model. Free-tier keys are often capped near 20 requests/day.',
  },
]

/** Pass 2 adds an inherit option; picking it sends no correction override at all. */
export const INHERIT_CORRECTION_MODEL_ID = 'same-as-pass-1'

export const CORRECTION_MODELS = [
  {
    id: INHERIT_CORRECTION_MODEL_ID,
    label: 'Same as pass 1',
    provider: null,
    model: null,
    description: 'Correction pass reuses the pass-1 model.',
  },
  ...ANALYZE_MODELS,
]

export const DEFAULT_ANALYZE_MODEL_ID = 'gemini-2.5-flash'
export const DEFAULT_CORRECTION_MODEL_ID = INHERIT_CORRECTION_MODEL_ID

export function getAnalyzeModelById(id) {
  return ANALYZE_MODELS.find((m) => m.id === id) ?? getDefaultAnalyzeModel()
}

export function getCorrectionModelById(id) {
  return CORRECTION_MODELS.find((m) => m.id === id) ?? CORRECTION_MODELS[0]
}

export function getDefaultAnalyzeModel() {
  return (
    ANALYZE_MODELS.find((m) => m.id === DEFAULT_ANALYZE_MODEL_ID) ?? ANALYZE_MODELS[0]
  )
}

/**
 * Map the two model choices to the fields POST /analyze expects.
 * @param {string} modelId pass-1 model id
 * @param {string} correctionModelId pass-2 model id (or the inherit sentinel)
 */
export function visionOverrideFromAnalyzeModel(modelId, correctionModelId) {
  const extraction = getAnalyzeModelById(modelId)
  const correction = getCorrectionModelById(correctionModelId)

  return {
    visionProvider: extraction?.provider ?? null,
    visionModel: extraction?.model ?? null,
    // null on inherit — the backend then applies its own fallback chain.
    visionCorrectionProvider: correction?.provider ?? null,
    visionCorrectionModel: correction?.model ?? null,
  }
}
