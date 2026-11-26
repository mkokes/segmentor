import type {
  RingConfig,
  RingGeometryMetrics,
  RingOverlapDiagnostic,
  ShopSettings,
  StripCutSpec,
} from '../types/vessel';
import type { ProfileSampler } from './spline';
import { degToRad } from './units';

export function countSegmentsBySpecies(
  speciesPattern: string[],
  segments: number,
  fallbackSpeciesId = 'maple',
): Map<string, number> {
  const counts = new Map<string, number>();
  const pattern = speciesPattern.length > 0 ? speciesPattern : [fallbackSpeciesId];
  for (let i = 0; i < segments; i++) {
    const speciesId = pattern[i % pattern.length] ?? fallbackSpeciesId;
    counts.set(speciesId, (counts.get(speciesId) ?? 0) + 1);
  }
  return counts;
}

export function computeStripCutsForRing(
  speciesPattern: string[],
  segments: number,
  sel: number,
  iel: number,
  miterAngleDeg: number,
  settings: Pick<ShopSettings, 'sawKerf' | 'endTrimAllowance'>,
): StripCutSpec[] {
  const counts = countSegmentsBySpecies(speciesPattern, segments);
  const cosMiter = Math.max(0.05, Math.cos(degToRad(miterAngleDeg)));
  const axialKerf = settings.sawKerf / cosMiter;
  const avgPitch = (sel + iel) / 2;

  const specs: StripCutSpec[] = [];
  for (const [speciesId, segmentCount] of counts.entries()) {
    const stripLength =
      segmentCount * avgPitch + (segmentCount + 1) * axialKerf + settings.endTrimAllowance;
    specs.push({ speciesId, segmentCount, stripLength });
  }
  return specs;
}

export function calculateClosedRing(
  ring: RingConfig,
  yBottom: number,
  sampler: ProfileSampler,
  settings: ShopSettings,
): RingGeometryMetrics {
  const yTop = yBottom + ring.height;
  const env = sampler.sampleEnvelope(yBottom, yTop);

  const rOuterGlue = env.rOuterMax + settings.turningAllowanceOut;
  const rInnerGlue = ring.isBaseDisk ? 0 : Math.max(0, env.rInnerMin - settings.turningAllowanceIn);

  if (ring.isBaseDisk) {
    const diameter = 2 * rOuterGlue;
    const primarySpecies = ring.speciesPattern[0] ?? 'maple';
    const stripLength = diameter + settings.endTrimAllowance;
    return {
      ringId: ring.id,
      index: ring.index,
      isBaseDisk: true,
      mode: 'closed',
      yBottom,
      yTop,
      height: ring.height,
      segments: 1,
      miterAngleDeg: 0,
      gapDegrees: 0,
      openPercent: 0,
      indexingAngleDeg: 0,
      rOuterFinishedMax: env.rOuterMax,
      rInnerFinishedMin: env.rInnerMin,
      rOuterGlue,
      rOuterVertex: rOuterGlue,
      rInnerGlue: 0,
      segmentEdgeLength: diameter,
      innerEdgeLength: 0,
      boardWidth: diameter,
      gapWidthInner: 0,
      gapWidthOuter: 0,
      stripCuts: [
        {
          speciesId: primarySpecies,
          segmentCount: 1,
          stripLength,
        },
      ],
      totalLinearLength: stripLength,
    };
  }

  const segments = Math.max(3, Math.round(ring.segments));
  const miterAngleDeg = 180 / segments;
  const thetaRad = degToRad(miterAngleDeg);
  const tanTheta = Math.tan(thetaRad);
  const cosTheta = Math.cos(thetaRad);

  const rOuterVertex = rOuterGlue / cosTheta;
  const segmentEdgeLength = 2 * rOuterGlue * tanTheta;
  const innerEdgeLength = 2 * rInnerGlue * tanTheta;
  const boardWidth = Math.max(0, rOuterGlue - rInnerGlue);

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
    mode: 'closed',
    yBottom,
    yTop,
    height: ring.height,
    segments,
    miterAngleDeg,
    gapDegrees: 0,
    openPercent: 0,
    indexingAngleDeg: 360 / segments,
    rOuterFinishedMax: env.rOuterMax,
    rInnerFinishedMin: env.rInnerMin,
    rOuterGlue,
    rOuterVertex,
    rInnerGlue,
    segmentEdgeLength,
    innerEdgeLength,
    boardWidth,
    gapWidthInner: 0,
    gapWidthOuter: 0,
    stripCuts,
    totalLinearLength,
  };
}

export function evaluateClosedRingOverlap(
  lower: RingGeometryMetrics,
  upper: RingGeometryMetrics,
): RingOverlapDiagnostic {
  const radialOverlap =
    Math.min(lower.rOuterGlue, upper.rOuterGlue) - Math.max(lower.rInnerGlue, upper.rInnerGlue);

  if (radialOverlap <= 0) {
    return {
      lowerRingId: lower.ringId,
      upperRingId: upper.ringId,
      lowerIndex: lower.index,
      upperIndex: upper.index,
      radialOverlap,
      verticalBondRatio: 0,
      status: 'error',
      message: `No glue overlap between Ring ${lower.index} and Ring ${upper.index} — wall will blow through`,
    };
  }

  if (radialOverlap < 0.25) {
    return {
      lowerRingId: lower.ringId,
      upperRingId: upper.ringId,
      lowerIndex: lower.index,
      upperIndex: upper.index,
      radialOverlap,
      verticalBondRatio: 1,
      status: 'warn',
      message: `Tight overlap (${radialOverlap.toFixed(3)}") between Ring ${lower.index} and Ring ${upper.index}`,
    };
  }

  return {
    lowerRingId: lower.ringId,
    upperRingId: upper.ringId,
    lowerIndex: lower.index,
    upperIndex: upper.index,
    radialOverlap,
    verticalBondRatio: 1,
    status: 'safe',
    message: 'Safe glue joint overlap',
  };
}
