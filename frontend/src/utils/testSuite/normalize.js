/**
 * Normalize ground-truth or AI analyze responses into comparable room records.
 */

function parseNum(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * @typedef {{ page: number, name: string, normName: string, lengthFt: number|null, widthFt: number|null, areaSqft: number|null, source: string }} NormRoom
 */

/**
 * @param {object} data - Ground truth or API analyze JSON
 * @returns {NormRoom[]}
 */
export function extractRoomsFromPayload(data) {
  if (!data || typeof data !== 'object') return []

  const out = []

  const pushRoom = (room, page) => {
    const name = room.name ?? room.area_name ?? room.room_name ?? 'Unknown'
    const lengthFt = parseNum(room.length_ft ?? room.lengthFt ?? room.length)
    const widthFt = parseNum(room.width_ft ?? room.widthFt ?? room.width ?? room.breadth_ft)
    const areaSqft = parseNum(room.area_sqft ?? room.areaSqft ?? room.area)

    out.push({
      page,
      name: String(name),
      normName: normalizeName(name),
      lengthFt,
      widthFt,
      areaSqft,
      source: room.dimension_source ?? room.method ?? '',
    })
  }

  if (Array.isArray(data.rooms)) {
    data.rooms.forEach((r) => pushRoom(r, data.page ?? data.page_number ?? 1))
    return out
  }

  const pages = data.pages ?? []
  for (const page of pages) {
    const pageNum = page.page_number ?? page.page ?? 1
    if (page.eligible === false) continue
    for (const room of page.rooms ?? []) {
      pushRoom(room, pageNum)
    }
  }

  return out
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
