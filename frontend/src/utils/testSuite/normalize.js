/**
 * Normalize ground-truth or AI analyze responses into comparable room records.
 */

/** Match analyze tab row parsing — keep 0, only drop non-finite values. */
function parseNum(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * @typedef {{ page: number, planNumber: number, sourcePage: number, floorLabel: string|null, name: string, normName: string, lengthFt: number|null, widthFt: number|null, areaSqft: number|null, source: string }} NormRoom
 */

/**
 * @param {object} data - Ground truth or API analyze JSON
 * @returns {NormRoom[]}
 */
export function extractRoomsFromPayload(data) {
  if (!data || typeof data !== 'object') return []

  const out = []

  const pushRoom = (room, page, meta = {}) => {
    const name = room.name ?? room.area_name ?? room.room_name ?? 'Unknown'
    const lengthFt = parseNum(room.length_ft ?? room.lengthFt ?? room.length)
    const widthFt = parseNum(room.width_ft ?? room.widthFt ?? room.width ?? room.breadth_ft)
    const areaSqft = parseNum(room.area_sqft ?? room.areaSqft ?? room.area)

    out.push({
      page,
      planNumber: meta.planNumber ?? page,
      sourcePage: meta.sourcePage ?? page,
      floorLabel: meta.floorLabel ?? null,
      name: String(name),
      normName: normalizeName(name),
      lengthFt,
      widthFt,
      areaSqft,
      source: room.dimension_source ?? room.method ?? '',
    })
  }

  if (Array.isArray(data.rooms)) {
    const planNumber = data.plan_number ?? data.page ?? data.page_number ?? 1
    const sourcePage = data.source_page ?? data.sourcePage ?? data.page_number ?? planNumber
    data.rooms.forEach((r) =>
      pushRoom(r, planNumber, {
        planNumber,
        sourcePage,
        floorLabel: data.floor_label ?? data.floorLabel ?? null,
      }),
    )
    return out
  }

  const pages = data.pages ?? []
  for (const page of pages) {
    const pageNum = page.plan_number ?? page.page ?? page.page_number ?? 1
    const sourcePage = page.source_page ?? page.sourcePage ?? page.page_number ?? pageNum
    // Same rule as normalizeAnalyzeResponse: only skip explicitly ineligible pages.
    if (page.eligible === false) continue
    for (const room of page.rooms ?? []) {
      pushRoom(room, pageNum, {
        planNumber: pageNum,
        sourcePage,
        floorLabel: page.floor_label ?? page.floorLabel ?? null,
      })
    }
  }

  return out
}

/**
 * Human-readable reason when analyze JSON cannot be evaluated (no extractable rooms).
 * @param {object} aiJson
 * @returns {string|null}
 */
export function describeAnalyzeEvalBlocker(aiJson) {
  if (extractRoomsFromPayload(aiJson).length) return null

  const pages = aiJson?.pages ?? []
  if (!pages.length) {
    const detail = aiJson?.detail
    const msg =
      (typeof detail === 'object' && detail?.message) ||
      (typeof detail === 'string' ? detail : null) ||
      aiJson?.error_message ||
      aiJson?.message
    return msg ? `Analysis failed: ${msg}` : 'Analyze response has no pages.'
  }

  const reason = pages
    .filter((p) => p.eligible === false)
    .map((p) => p.ineligible_reason)
    .find(Boolean)

  if (reason) {
    return `Analysis produced no rooms: ${reason}`
  }

  return 'AI response contains no rooms to compare.'
}

export function parseGroundTruthFile(text) {
  const data = JSON.parse(text)
  const rooms = extractRoomsFromPayload(data)
  if (!rooms.length) {
    throw new Error(
      'No rooms found. Use { "rooms": [...] } or { "pages": [{ "rooms": [...] }] }.',
    )
  }
  return { raw: data, rooms }
}
