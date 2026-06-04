/**
 * Compare AI analyze output vs ground truth (order-independent, L/W swap ignored).
 */

import { extractRoomsFromPayload } from './normalize'

const DEFAULT_DIM_TOLERANCE_FT = 0.0
const DEFAULT_AREA_TOLERANCE_SQFT = 0
const NAME_MATCH_THRESHOLD = 0.72

function normalizeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Sorted pair so length/breadth order does not matter. */
export function sortedDimensionPair(lengthFt, widthFt) {
  const vals = [lengthFt, widthFt].filter((v) => v != null && Number.isFinite(v))
  if (vals.length !== 2) return null
  return [Math.min(vals[0], vals[1]), Math.max(vals[0], vals[1])]
}

export function dimensionsMatch(
  gtL,
  gtW,
  aiL,
  aiW,
  toleranceFt = DEFAULT_DIM_TOLERANCE_FT,
) {
  const gt = sortedDimensionPair(gtL, gtW);
  const ai = sortedDimensionPair(aiL, aiW);

  // Both GT and AI have no dimensions -> correct
  if (!gt && !ai) {
    return true;
  }

  // Only one side has dimensions -> incorrect
  if (!gt || !ai) {
    return false;
  }

  return (
    Math.abs(gt[0] - ai[0]) <= toleranceFt &&
    Math.abs(gt[1] - ai[1]) <= toleranceFt
  );
}

export function areaMatch(
  gtArea,
  aiArea,
  gtL,
  gtW,
  aiL,
  aiW,
  tol = DEFAULT_AREA_TOLERANCE_SQFT,
) {
  // Both GT and AI missing area
  if (gtArea == null && aiArea == null) {
    const gtPair = sortedDimensionPair(gtL, gtW);
    const aiPair = sortedDimensionPair(aiL, aiW);

    // Both also missing dimensions -> correct
    if (!gtPair && !aiPair) {
      return true;
    }

    // One side has dimensions and the other doesn't
    if (!gtPair || !aiPair) {
      return false;
    }

    const gtA = gtPair[0] * gtPair[1];
    const aiA = aiPair[0] * aiPair[1];

    return Math.abs(gtA - aiA) <= tol;
  }

  // One area missing but the other exists
  if ((gtArea == null) !== (aiArea == null)) {
    return false;
  }

  // Direct area comparison
  if (gtArea != null && aiArea != null) {
    return Math.abs(gtArea - aiArea) <= tol;
  }

  return false;
}

function nameSimilarity(a, b) {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.88

  const longer = na.length >= nb.length ? na : nb
  const shorter = na.length < nb.length ? na : nb
  if (longer.includes(shorter) && shorter.length >= 4) return 0.8

  // token overlap
  const ta = new Set(na.split(/\s+/).filter(Boolean))
  const tb = new Set(nb.split(/\s+/).filter(Boolean))
  let inter = 0
  for (const t of ta) {
    if (tb.has(t)) inter += 1
  }
  const union = ta.size + tb.size - inter
  return union > 0 ? inter / union : 0
}

function matchScore(gt, ai) {
  const ns = nameSimilarity(gt.normName, ai.normName)
  const dm = dimensionsMatch(gt.lengthFt, gt.widthFt, ai.lengthFt, ai.widthFt)
  const am = areaMatch(
    gt.areaSqft,
    ai.areaSqft,
    gt.lengthFt,
    gt.widthFt,
    ai.lengthFt,
    ai.widthFt,
  )
  return { ns, dm, am, score: ns * 3 + (dm ? 4 : 0) + (am ? 1 : 0) }
}

/**
 * Greedy one-to-one matching (GT order ignored, AI order ignored).
 */
export function matchRooms(gtRooms, aiRooms) {
  const unmatchedAi = new Set(aiRooms.map((_, i) => i))
  const pairs = []

  for (const gt of gtRooms) {
    let bestIdx = -1
    let best = null

    for (const aiIdx of unmatchedAi) {
      const ai = aiRooms[aiIdx]
      if (gt.page !== ai.page) continue
      const m = matchScore(gt, ai)
      if (m.ns < NAME_MATCH_THRESHOLD && !m.dm) continue
      if (!best || m.score > best.score) {
        best = { aiIdx, ai, ...m }
        bestIdx = aiIdx
      }
    }

    if (bestIdx >= 0 && best) {
      unmatchedAi.delete(bestIdx)
      pairs.push({
        gt,
        ai: best.ai,
        nameSimilarity: best.ns,
        dimensionsMatch: best.dm,
        areaMatch: best.am,
        status: best.dm ? 'match' : best.ns >= NAME_MATCH_THRESHOLD ? 'name_only' : 'weak',
      })
    } else {
      pairs.push({ gt, ai: null, dimensionsMatch: false, areaMatch: false, status: 'missed' })
    }
  }

  const falsePositives = [...unmatchedAi].map((aiIdx) => ({
    gt: null,
    ai: aiRooms[aiIdx],
    dimensionsMatch: false,
    status: 'extra',
  }))

  return [...pairs, ...falsePositives]
}

export function computeMetrics(gtRooms, aiRooms, pairs) {
  // -----------------------------
  // ROOM DETECTION CONFUSION MATRIX
  // -----------------------------
  const tp = pairs.filter((p) => p.gt && p.ai).length;
  const fn = pairs.filter((p) => p.gt && !p.ai).length;
  const fp = pairs.filter((p) => !p.gt && p.ai).length;

  const gtCount = gtRooms.length;
  const aiCount = aiRooms.length;

  const roomPrecision = tp + fp > 0 ? tp / (tp + fp) : 0;

  const roomRecall = tp + fn > 0 ? tp / (tp + fn) : 0;

  const roomAccuracy = gtCount > 0 ? tp / gtCount : 0;

  const roomF1 = 2 * tp + fp + fn > 0 ? (2 * tp) / (2 * tp + fp + fn) : 0;

  // -----------------------------
  // DIMENSION EXTRACTION CONFUSION MATRIX
  // -----------------------------
  const matchedWithGt = pairs.filter((p) => p.gt && p.ai);

  let dimTP = 0;
  let dimFP = 0;
  let dimFN = 0;

  for (const pair of matchedWithGt) {
    const gtHasDims = pair.gt.lengthFt != null && pair.gt.widthFt != null;

    const aiHasDims = pair.ai.lengthFt != null && pair.ai.widthFt != null;

    if (pair.dimensionsMatch) {
      dimTP++;
    } else if (gtHasDims && aiHasDims) {
      dimFP++;
    } else if (gtHasDims && !aiHasDims) {
      dimFN++;
    } else if (!gtHasDims && aiHasDims) {
      dimFP++;
    }
  }

  const dimensionPrecision = dimTP + dimFP > 0 ? dimTP / (dimTP + dimFP) : 0;

  const dimensionRecall = dimTP + dimFN > 0 ? dimTP / (dimTP + dimFN) : 0;

  const dimensionF1 =
    2 * dimTP + dimFP + dimFN > 0
      ? (2 * dimTP) / (2 * dimTP + dimFP + dimFN)
      : 0;

  const dimensionAccuracy = gtCount > 0 ? dimTP / gtCount : 0;

  // -----------------------------
  // AREA METRICS
  // -----------------------------
  const areaCorrect = matchedWithGt.filter((p) => p.areaMatch).length;

  const areaAccuracy = gtCount > 0 ? areaCorrect / gtCount : 0;

  return {
    gtCount,
    aiCount,

    // ROOM METRICS
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,

    roomPrecision,
    roomRecall,
    roomAccuracy,
    roomF1,

    // DIMENSION METRICS
    dimensionTP: dimTP,
    dimensionFP: dimFP,
    dimensionFN: dimFN,

    dimensionPrecision,
    dimensionRecall,
    dimensionF1,
    dimensionAccuracy,

    dimCorrect: dimTP,

    // AREA METRICS
    areaAccuracy,
    areaCorrect,

    pairs,
  };
}

/**
 * Full evaluation pipeline.
 * @param {object} groundTruthJson
 * @param {object} aiJson - Raw POST /analyze response
 */
export function evaluateAgainstGroundTruth(groundTruthJson, aiJson) {
  const gtRooms = extractRoomsFromPayload(groundTruthJson)
  const aiRooms = extractRoomsFromPayload(aiJson)

  if (!gtRooms.length) {
    throw new Error('Ground truth contains no rooms.')
  }
  if (!aiRooms.length) {
    throw new Error('AI response contains no rooms to compare.')
  }

  const pairs = matchRooms(gtRooms, aiRooms)
  const metrics = computeMetrics(gtRooms, aiRooms, pairs)

  return { gtRooms, aiRooms, ...metrics }
}
