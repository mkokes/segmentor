import type {
  RingConfig,
  RingGeometryMetrics,
  RingOverlapDiagnostic,
  ShopSettings,
} from '../types/vessel';
import { computeStripCutsForRing } from './closedRing';
import type { ProfileSampler } from './spline';
import { degToRad } from './units';

export function openPercentFromGapDegrees(segments: number, gapDegrees: number): number {
  const pitch = 360 / Math.max(3, segments);
  return Math.max(0, Math.min(95, (gapDegrees / pitch) * 100));
}

export function gapDegreesFromOpenPercent(segments: number, openPercent: number): number {
  const pitch = 360 / Math.max(3, segments);
  const clampedPct = Math.max(0, Math.min(80, openPercent));
  return (pitch * clampedPct) / 100;
}

export function calculateOpenRing(
  ring: RingConfig,
  yBottom: number,
  sampler: ProfileSampler,
  settings: ShopSettings,
): RingGeometryMetrics {
  const yTop = yBottom + ring.height;
  const env = sampler.sampleEnvelope(yBottom, yTop);

  const rOuterGlue = env.rOuterMax + settings.turningAllowanceOut;
  const rInnerGlue = Math.max(0, env.rInnerMin - settings.turningAllowanceIn);

  const segments = Math.max(3, Math.round(ring.segments));
  const pitchDeg = 360 / segments;
  const maxGap = Math.max(0, pitchDeg - 1);
  const gapDegrees = Math.max(0, Math.min(maxGap, ring.gapDegrees));
  const segmentSweepDeg = pitchDeg - gapDegrees;
  const miterAngleDeg = segmentSweepDeg / 2;

  const halfSweepRad = degToRad(miterAngleDeg);
  const tanHalf = Math.tan(halfSweepRad);
  const cosHalf = Math.cos(halfSweepRad);
  const sinHalfGap = Math.sin(degToRad(gapDegrees / 2));

  const rOuterVertex = rOuterGlue / cosHalf;
  const segmentEdgeLength = 2 * rOuterGlue * tanHalf;
  const innerEdgeLength = 2 * rInnerGlue * tanHalf;
  const boardWidth = Math.max(0, rOuterGlue - rInnerGlue);
  const gapWidthInner = 2 * rInnerGlue * sinHalfGap;
  const gapWidthOuter = 2 * rOuterGlue * sinHalfGap;

  const stripCuts = computeStripCutsForRing(
    ring.speciesPattern,
    segments,
    segmentEdgeLength,
    innerEdgeLength,
    miterAngleDeg,
    settings,
  );
  const totalLinearLength = stripCuts.reduce((sum, s) => sum + s.stripLength, 0);

  return {
    ringId: ring.id,
    index: ring.index,
    isBaseDisk: false,
    mode: 'open',
    yBottom,
    yTop,
    height: ring.height,
    segments,
    miterAngleDeg,
    gapDegrees,
    openPercent: openPercentFromGapDegrees(segments, gapDegrees),
    indexingAngleDeg: pitchDeg,
    rOuterFinishedMax: env.rOuterMax,
    rInnerFinishedMin: env.rInnerMin,
    rOuterGlue,
    rOuterVertex,
    rInnerGlue,
    segmentEdgeLength,
    innerEdgeLength,
    boardWidth,
    gapWidthInner,
    gapWidthOuter,
    stripCuts,
    totalLinearLength,
  };
}

interface AngularInterval {
  start: number;
  end: number;
}

function getSolidArcIntervals(
  ring: RingGeometryMetrics,
  rotationOffsetDeg: number,
): AngularInterval[] {
  if (ring.isBaseDisk || ring.gapDegrees <= 1e-6) {
    return [{ start: 0, end: 360 }];
  }

  const pitch = 360 / ring.segments;
  const sweep = pitch - ring.gapDegrees;
  const raw: AngularInterval[] = [];

  for (let i = 0; i < ring.segments; i++) {
    const start = (((rotationOffsetDeg + i * pitch) % 360) + 360) % 360;
    const end = start + sweep;
    if (end <= 360) {
      raw.push({ start, end });
    } else {
      raw.push({ start, end: 360 });
      raw.push({ start: 0, end: end - 360 });
    }
  }
  return raw;
}

export function computeVerticalArcBondRatio(
  lower: RingGeometryMetrics,
  lowerOffsetDeg: number,
  upper: RingGeometryMetrics,
  upperOffsetDeg: number,
): number {
  const lowerIntervals = getSolidArcIntervals(lower, lowerOffsetDeg);
  const upperIntervals = getSolidArcIntervals(upper, upperOffsetDeg);

  let overlapDeg = 0;
  for (const a of lowerIntervals) {
    for (const b of upperIntervals) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) {
        overlapDeg += end - start;
      }
    }
  }

  const upperSolidDeg = upperIntervals.reduce((s, iv) => s + (iv.end - iv.start), 0);
  if (upperSolidDeg <= 1e-6) return 0;
  return Math.max(0, Math.min(1, overlapDeg / upperSolidDeg));
}

export function evaluateRingPairOverlap(
  lower: RingGeometryMetrics,
  lowerOffsetDeg: number,
  upper: RingGeometryMetrics,
  upperOffsetDeg: number,
): RingOverlapDiagnostic {
  const radialOverlap =
    Math.min(lower.rOuterGlue, upper.rOuterGlue) - Math.max(lower.rInnerGlue, upper.rInnerGlue);

  const verticalBondRatio = computeVerticalArcBondRatio(
    lower,
    lowerOffsetDeg,
    upper,
    upperOffsetDeg,
  );

  if (radialOverlap <= 0) {
    return {
      lowerRingId: lower.ringId,
      upperRingId: upper.ringId,
      lowerIndex: lower.index,
      upperIndex: upper.index,
      radialOverlap,
      verticalBondRatio,
      status: 'error',
      message: `No radial overlap between Ring ${lower.index} and Ring ${upper.index}`,
    };
  }

  if ((lower.mode === 'open' || upper.mode === 'open') && verticalBondRatio < 0.4) {
    return {
      lowerRingId: lower.ringId,
      upperRingId: upper.ringId,
      lowerIndex: lower.index,
      upperIndex: upper.index,
      radialOverlap,
      verticalBondRatio,
      status: verticalBondRatio <= 0.1 ? 'error' : 'warn',
      message: `Low open-segment bond overlap (${Math.round(verticalBondRatio * 100)}%) between Ring ${lower.index} and Ring ${upper.index} — check stagger or gap`,
    };
  }

  if (radialOverlap < 0.25) {
    return {
      lowerRingId: lower.ringId,
      upperRingId: upper.ringId,
      lowerIndex: lower.index,
      upperIndex: upper.index,
      radialOverlap,
      verticalBondRatio,
      status: 'warn',
      message: `Tight radial overlap (${radialOverlap.toFixed(3)}") between Ring ${lower.index} and Ring ${upper.index}`,
    };
  }

  return {
    lowerRingId: lower.ringId,
    upperRingId: upper.ringId,
    lowerIndex: lower.index,
    upperIndex: upper.index,
    radialOverlap,
    verticalBondRatio,
    status: 'safe',
    message: 'Safe glue joint overlap',
  };
}
