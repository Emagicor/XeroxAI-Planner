/**
 * Test suite I/O
 *
 * Load:  GET /test-suite/manifest.json + case files (static, repo folder)
 * Save:  POST /api/test-suite/save → creates test-suite/cases/{id}/ + updates manifest.json
 * Update: PUT /api/test-suite/cases/{id}
 * Delete: DELETE /api/test-suite/cases/{id}
 */
export const TEST_SUITE_STATIC_BASE = '/test-suite'

async function parseError(res) {
  const err = await res.json().catch(() => ({}))
  return err.message || err.detail || `Request failed (${res.status})`
}

function staticCaseInputUrl(meta) {
  return `${TEST_SUITE_STATIC_BASE}/cases/${encodeURIComponent(meta.id)}/${encodeURIComponent(meta.inputFile)}`
}

function staticCaseGroundTruthUrl(meta) {
  return `${TEST_SUITE_STATIC_BASE}/cases/${encodeURIComponent(meta.id)}/${encodeURIComponent(meta.groundTruthFile ?? 'ground-truth.json')}`
}

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** Preload: read manifest.json from repo test-suite/ folder. */
export async function fetchTestSuiteCases() {
  const res = await fetch(`${TEST_SUITE_STATIC_BASE}/manifest.json?t=${Date.now()}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Could not load test-suite/manifest.json (${res.status})`)
  }
  const data = await res.json()
  return data.cases ?? []
}

export async function fetchTestCaseInput(meta) {
  const res = await fetch(staticCaseInputUrl(meta), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Could not load input for case "${meta.id}" (${res.status})`)
  return res.blob()
}

export async function fetchTestCaseGroundTruth(meta) {
  const res = await fetch(staticCaseGroundTruthUrl(meta), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Could not load ground truth for case "${meta.id}" (${res.status})`)
  return res.text()
}

/** Save new case → test-suite/cases/{id}/ + manifest.json entry. */
export async function saveTestSuiteCase({ label, inputFile, groundTruth }) {
  const res = await fetch('/api/test-suite/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      label: label ?? '',
      inputFileName: inputFile.name,
      inputBase64: await fileToBase64(inputFile),
      groundTruth,
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

/** Update existing case folder + manifest entry. */
export async function updateTestSuiteCase(caseId, { label, inputFile, groundTruth }) {
  const body = { label }
  if (inputFile) {
    body.inputFileName = inputFile.name
    body.inputBase64 = await fileToBase64(inputFile)
  }
  if (groundTruth) body.groundTruth = groundTruth

  const res = await fetch(`/api/test-suite/cases/${encodeURIComponent(caseId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

/** Delete case folder + remove from manifest.json. */
export async function deleteTestSuiteCase(caseId) {
  const res = await fetch(`/api/test-suite/cases/${encodeURIComponent(caseId)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(await parseError(res))
}
