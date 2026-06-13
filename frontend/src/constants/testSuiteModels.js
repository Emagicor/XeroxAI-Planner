/**
 * Vision models available for test-suite batch runs.
 *
 * Plug-and-play: add a new entry via buildTestSuiteModel() and append to TEST_SUITE_MODELS.
 * Backend must implement the provider in backend2.0/src/providers/vision/ and set the API key in .env.
 *
 * Every batch run always calls POST /analyze — no Analyze-tab cache reuse.
 */

export const TEST_SUITE_MODELS = [
  {
    id: 'server-default',
    label: 'Server default',
    description: 'Uses VISION_PROVIDER / VISION_MODEL from backend .env (pass 1). Pass 2 from VISION_CORRECTION_*.',
    provider: null,
    model: null,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI GPT-4o for pass-1 extraction.',
    provider: 'openai',
    model: 'gpt-4o',
  },
  {
    id: 'gemini-2.5',
    label: 'Gemini 2.5 Flash',
    description: 'Google Gemini 2.5 Flash for pass-1 extraction.',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  },
  {
    id: 'gemini-3.5',
    label: 'Gemini 3.5 Flash',
    description: 'Google Gemini 3.5 Flash for pass-1 extraction.',
    provider: 'gemini',
    model: 'gemini-3.5-flash',
  },
  {
    id: 'groq-llama-scout',
    label: 'Groq Llama 4 Scout',
    description: 'Groq Llama 4 Scout for pass-1 extraction.',
    provider: 'groq',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  },
]

export const DEFAULT_TEST_SUITE_MODEL_ID = 'server-default'

/**
 * Create a test-suite model registry entry (plug-and-play for new providers).
 * @param {{ id: string, label: string, provider: string, model: string, description?: string }} config
 */
export function buildTestSuiteModel({ id, label, provider, model, description }) {
  return {
    id,
    label,
    description: description ?? `${provider} / ${model} for pass-1 extraction.`,
    provider,
    model,
  }
}

export function getTestSuiteModelById(id) {
  return TEST_SUITE_MODELS.find((m) => m.id === id) ?? TEST_SUITE_MODELS[0]
}

/** True when the model entry does not override backend .env defaults. */
export function isServerDefaultModel(modelChoice) {
  return !modelChoice?.provider && !modelChoice?.model
}

/**
 * Map a model choice to form fields sent to POST /analyze.
 * Pass 2 (correction) uses backend VISION_CORRECTION_* env unless correction* overrides are set.
 */
export function visionOverrideFromModelChoice(modelChoice) {
  if (!modelChoice || isServerDefaultModel(modelChoice)) {
    return {
      visionProvider: null,
      visionModel: null,
      visionCorrectionProvider: null,
      visionCorrectionModel: null,
    }
  }
  return {
    visionProvider: modelChoice.provider,
    visionModel: modelChoice.model,
    visionCorrectionProvider: modelChoice.correctionProvider ?? null,
    visionCorrectionModel: modelChoice.correctionModel ?? null,
  }
}

export function formatTestSuiteModelLabel(run) {
  if (!run) return null
  if (run.modelLabel) return run.modelLabel
  if (run.visionModel) return run.visionModel
  return null
}
