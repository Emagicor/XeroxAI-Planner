/** Vision models available for test-suite batch runs. */

export const TEST_SUITE_MODELS = [

  {

    id: 'server-default',

    label: 'Server default',

    description: 'Same provider and model as the Analyze tab (backend .env).',

    matchesAnalyzeTab: true,

    provider: null,

    model: null,

  },

  {

    id: 'gpt-4o',

    label: 'GPT-4o',

    description: 'Override vision provider for benchmark runs.',

    matchesAnalyzeTab: false,

    provider: 'openai',

    model: 'gpt-4o',

  },

  {

    id: 'gemini-2.5',

    label: 'Gemini 2.5 Flash',

    description: 'Override vision provider for benchmark runs.',

    matchesAnalyzeTab: false,

    provider: 'gemini',

    model: 'gemini-2.5-flash',

  },

  {

    id: 'gemini-3.5',

    label: 'Gemini 3.5 Flash',

    description: 'Override vision provider for benchmark runs.',

    matchesAnalyzeTab: false,

    provider: 'gemini',

    model: 'gemini-3.5-flash',

  },

  {

    id: 'groq-llama-scout',

    label: 'Groq Llama 4 Scout',

    description: 'Override vision provider for benchmark runs.',

    matchesAnalyzeTab: false,

    provider: 'groq',

    model: 'meta-llama/llama-4-scout-17b-16e-instruct',

  },

  {

    id: 'florence2-large',

    label: 'Florence-2 Large',

    description: 'Local HuggingFace Florence-2 vision (OCR / caption tasks).',

    matchesAnalyzeTab: false,

    provider: 'florence2',

    model: 'microsoft/Florence-2-large',

  },

  {

    id: 'qwen25-vl-7b',

    label: 'Qwen2.5-VL 7B',

    description: 'Hugging Face Inference — multimodal JSON floor-plan extraction.',

    matchesAnalyzeTab: false,

    provider: 'qwen25_vl',

    model: 'Qwen/Qwen2.5-VL-7B-Instruct',

  },

]



export const DEFAULT_TEST_SUITE_MODEL_ID = 'server-default'



export function getTestSuiteModelById(id) {

  return TEST_SUITE_MODELS.find((m) => m.id === id) ?? TEST_SUITE_MODELS[0]

}



export function visionOverrideFromModelChoice(modelChoice) {

  if (!modelChoice || modelChoice.matchesAnalyzeTab) {

    return { visionProvider: null, visionModel: null }

  }

  return {

    visionProvider: modelChoice.provider,

    visionModel: modelChoice.model,

  }

}



export function formatTestSuiteModelLabel(run) {

  if (!run) return null

  if (run.modelLabel) return run.modelLabel

  if (run.visionModel) return run.visionModel

  return null

}

