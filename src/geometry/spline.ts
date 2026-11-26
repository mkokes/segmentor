import type {
  ProfileEnvelope,
  ProfilePoint,
  SampledProfilePoint,
  ShopSettings,
} from '../types/vessel';

export interface ProfileSampler {
  height: number;
  samples: SampledProfilePoint[];
  rOuterAtY: (y: number) => number;
  rInnerAtY: (y: number) => number;
  sampleEnvelope: (yBottom: number, yTop: number, steps?: number) => ProfileEnvelope;
}

function evalCubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function evalCubicBezierDeriv(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

function interpolateSortedByY(pts: Array<{ y: number; r: number }>, yQuery: number): number {
  if (pts.length === 0) return 0;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return 0;
  if (yQuery <= first.y) return first.r;
  if (yQuery >= last.y) return last.r;

  let lo = 0;
  let hi = pts.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    const midPt = pts[mid];
    if (!midPt) break;
    if (midPt.y <= yQuery) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const pA = pts[lo];
  const pB = pts[hi];
  if (!pA || !pB) return first.r;
  const dy = pB.y - pA.y;
  if (dy <= 1e-9) return pA.r;
  const alpha = (yQuery - pA.y) / dy;
  return pA.r + alpha * (pB.r - pA.r);
}

export function buildProfileSampler(
  points: ProfilePoint[],
  settings: Pick<ShopSettings, 'wallThickness' | 'baseThickness'>,
  stepsPerSegment = 64,
): ProfileSampler {
  if (points.length === 0) {
    return {
      height: 0,
      samples: [],
      rOuterAtY: () => 0,
      rInnerAtY: () => 0,
      sampleEnvelope: () => ({
        rOuterMax: 0,
        rOuterMin: 0,
        rInnerMin: 0,
        rInnerMax: 0,
      }),
    };
  }

  const sortedPoints = points.toSorted((a, b) => a.y - b.y);
  const outerSamples: Array<{ y: number; r: number }> = [];
  const innerOffsetPoints: Array<{ y: number; r: number }> = [];

  if (sortedPoints.length === 1) {
    const only = sortedPoints[0]!;
    outerSamples.push({ y: only.y, r: Math.max(0, only.r) });
    innerOffsetPoints.push({
      y: Math.max(settings.baseThickness, only.y),
      r: Math.max(0, only.r - settings.wallThickness),
    });
  } else {
    for (let segIdx = 0; segIdx < sortedPoints.length - 1; segIdx++) {
      const a = sortedPoints[segIdx]!;
      const b = sortedPoints[segIdx + 1]!;
      const r0 = a.r;
      const y0 = a.y;
      const r1 = a.r + a.handleOut.dr;
      const y1 = a.y + a.handleOut.dy;
      const r2 = b.r + b.handleIn.dr;
      const y2 = b.y + b.handleIn.dy;
      const r3 = b.r;
      const y3 = b.y;

      const startStep = segIdx === 0 ? 0 : 1;
      for (let step = startStep; step <= stepsPerSegment; step++) {
        const t = step / stepsPerSegment;
        const r = Math.max(0, evalCubicBezier(r0, r1, r2, r3, t));
        const y = evalCubicBezier(y0, y1, y2, y3, t);
        const dr = evalCubicBezierDeriv(r0, r1, r2, r3, t);
        const dy = evalCubicBezierDeriv(y0, y1, y2, y3, t);
        const len = Math.hypot(dr, dy);

        // Enforce monotonic y on the sampled outer polyline
        const prevOuter = outerSamples[outerSamples.length - 1];
        const monoY = prevOuter ? Math.max(prevOuter.y, y) : y;
        outerSamples.push({ y: monoY, r });

        // Inward normal: tangent is (dr, dy) with dy >= 0; inward points (-dy, dr)
        const nx = len > 1e-9 ? -dy / len : -1;
        const ny = len > 1e-9 ? dr / len : 0;
        const rIn = Math.max(0, r + nx * settings.wallThickness);
        const yIn = y + ny * settings.wallThickness;
        innerOffsetPoints.push({ y: yIn, r: rIn });
      }
    }
  }

  const minY = outerSamples[0]?.y ?? 0;
  const maxY = outerSamples[outerSamples.length - 1]?.y ?? 0;

  // Normalize & make innerOffsetPoints strictly monotonic in y for lookup
  const cleanInnerPts: Array<{ y: number; r: number }> = [];
  const sortedInner = innerOffsetPoints.toSorted((a, b) => a.y - b.y);
  for (const pt of sortedInner) {
    const prev = cleanInnerPts[cleanInnerPts.length - 1];
    if (prev && Math.abs(pt.y - prev.y) < 1e-7) {
      prev.r = Math.min(prev.r, pt.r);
    } else {
      cleanInnerPts.push({ y: pt.y, r: pt.r });
    }
  }

  const rOuterAtY = (yQuery: number): number => {
    return interpolateSortedByY(outerSamples, yQuery);
  };

  const rInnerAtY = (yQuery: number): number => {
    const clampedY = Math.max(minY, Math.min(maxY, yQuery));
    if (clampedY < minY + settings.baseThickness - 1e-9) {
      return 0;
    }
    const rWall = interpolateSortedByY(cleanInnerPts, clampedY);
    const rOut = rOuterAtY(clampedY);
    return Math.max(0, Math.min(rWall, rOut));
  };

  const sampleEnvelope = (yBottom: number, yTop: number, steps = 24): ProfileEnvelope => {
    const lo = Math.max(minY, Math.min(yBottom, yTop));
    const hi = Math.min(maxY, Math.max(yBottom, yTop));
    let rOuterMax = 0;
    let rOuterMin = Number.POSITIVE_INFINITY;
    let rInnerMin = Number.POSITIVE_INFINITY;
    let rInnerMax = 0;

    const count = Math.max(2, steps);
    for (let i = 0; i <= count; i++) {
      const y = lo + ((hi - lo) * i) / count;
      const ro = rOuterAtY(y);
      const ri = rInnerAtY(y);
      if (ro > rOuterMax) rOuterMax = ro;
      if (ro < rOuterMin) rOuterMin = ro;
      if (ri < rInnerMin) rInnerMin = ri;
      if (ri > rInnerMax) rInnerMax = ri;
    }

    if (!Number.isFinite(rOuterMin)) rOuterMin = 0;
    if (!Number.isFinite(rInnerMin)) rInnerMin = 0;

    return { rOuterMax, rOuterMin, rInnerMin, rInnerMax };
  };

  const samples: SampledProfilePoint[] = outerSamples.map((s) => ({
    y: s.y,
    rOuter: s.r,
    rInner: rInnerAtY(s.y),
  }));

  return {
    height: Math.max(0, maxY - minY),
    samples,
    rOuterAtY,
    rInnerAtY,
    sampleEnvelope,
  };
}
