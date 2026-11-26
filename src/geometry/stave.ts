import type {
  ShopSettings,
  StaveTierConfig,
  StaveTierMetrics,
  StripCutSpec,
} from '../types/vessel';
import { countSegmentsBySpecies } from './closedRing';
import type { ProfileSampler } from './spline';
import { radToDeg } from './units';

export function calculateStaveTier(
  tier: StaveTierConfig,
  sampler: ProfileSampler,
  settings: ShopSettings,
  samplesPerTier = 32,
): StaveTierMetrics {
  const staveCount = Math.max(3, Math.round(tier.staveCount));
  const yBottom = tier.yBottom;
  const yTop = Math.max(yBottom + 0.05, tier.yTop);
  const tierHeight = yTop - yBottom;

  const rOuterFinBot = sampler.rOuterAtY(yBottom);
  const rOuterFinTop = sampler.rOuterAtY(yTop);
  const rInnerFinBot = sampler.rInnerAtY(yBottom);
  const rInnerFinTop = sampler.rInnerAtY(yTop);

  const rOuterBottom = rOuterFinBot + settings.turningAllowanceOut;
  const rOuterTop = rOuterFinTop + settings.turningAllowanceOut;
  const rInnerBottom = Math.max(0, rInnerFinBot - settings.turningAllowanceIn);
  const rInnerTop = Math.max(0, rInnerFinTop - settings.turningAllowanceIn);

  const deltaR = rOuterTop - rOuterBottom;
  const staveLength = Math.hypot(tierHeight, deltaR);

  // Tilt angle phi from vertical: 0° = vertical cylinder, + = flaring outward, - = tapering inward
  const phiRad = Math.atan2(deltaR, tierHeight);
  const tiltAngleDeg = radToDeg(phiRad);

  const thetaRad = Math.PI / staveCount;
  // Dihedral half-angle: sin(beta) = cos(phi) * sin(pi / N)
  const sinBevel = Math.max(-1, Math.min(1, Math.cos(phiRad) * Math.sin(thetaRad)));
  const bevelAngleDeg = radToDeg(Math.asin(sinBevel));

  // Miter gauge angle: tan(gamma) = sin(|phi|) * tan(pi / N)
  const miterAngleDeg = radToDeg(Math.atan(Math.sin(Math.abs(phiRad)) * Math.tan(thetaRad)));

  const tanTheta = Math.tan(thetaRad);
  const widthBottom = 2 * rOuterBottom * tanTheta;
  const widthTop = 2 * rOuterTop * tanTheta;

  const rOuterMax = Math.max(rOuterBottom, rOuterTop);
  const polygonalSagitta = rOuterMax * (1 / Math.cos(thetaRad) - 1);

  // Check curved profile bow relative to straight chords between bottom and top
  let maxCurveBowOut = 0;
  let maxCurveBowIn = 0;
  let maxChordRadialWall = Math.max(rOuterBottom - rInnerBottom, rOuterTop - rInnerTop);

  for (let i = 0; i <= samplesPerTier; i++) {
    const u = i / samplesPerTier;
    const y = yBottom + u * tierHeight;
    const chordOuter = rOuterBottom + u * (rOuterTop - rOuterBottom);
    const chordInner = rInnerBottom + u * (rInnerTop - rInnerBottom);
    const wallAtU = chordOuter - chordInner;
    if (wallAtU > maxChordRadialWall) maxChordRadialWall = wallAtU;

    const reqOuter = sampler.rOuterAtY(y) + settings.turningAllowanceOut;
    const reqInner = Math.max(0, sampler.rInnerAtY(y) - settings.turningAllowanceIn);

    const bowOut = reqOuter - chordOuter;
    const bowIn = chordInner - reqInner;
    if (bowOut > maxCurveBowOut) maxCurveBowOut = bowOut;
    if (bowIn > maxCurveBowIn) maxCurveBowIn = bowIn;
  }

  // Perpendicular stock thickness required across the tilted stave face
  const cosPhi = Math.max(0.15, Math.abs(Math.cos(phiRad)));
  const minRequiredRadial = maxChordRadialWall + maxCurveBowOut + maxCurveBowIn + polygonalSagitta;
  const minRequiredThickness = minRequiredRadial * cosPhi;
  const thicknessMargin = tier.stockThickness - minRequiredThickness;

  let status: StaveTierMetrics['status'] = 'safe';
  let warningMessage: string | null = null;
  if (thicknessMargin < 0) {
    status = 'error';
    warningMessage = `Stock thickness (${tier.stockThickness.toFixed(3)}") is thinner than required ${minRequiredThickness.toFixed(3)}" — curve bow or bevel will blow through`;
  } else if (thicknessMargin < 0.125) {
    status = 'warn';
    warningMessage = `Tight stock margin (${thicknessMargin.toFixed(3)}") on Tier ${tier.index}`;
  }

  const stripLengthPerStave = staveLength + settings.sawKerf + settings.endTrimAllowance * 0.25;

  const counts = countSegmentsBySpecies(tier.speciesPattern, staveCount);
  const stripCuts: StripCutSpec[] = [];
  for (const [speciesId, segmentCount] of counts.entries()) {
    const stripLength =
      segmentCount * staveLength +
      (segmentCount + 1) * settings.sawKerf +
      settings.endTrimAllowance;
    stripCuts.push({ speciesId, segmentCount, stripLength });
  }
  const totalLinearLength = stripCuts.reduce((sum, s) => sum + s.stripLength, 0);

  return {
    tierId: tier.id,
    index: tier.index,
    yBottom,
    yTop,
    tierHeight,
    staveCount,
    staveLength,
    tiltAngleDeg,
    bevelAngleDeg,
    miterAngleDeg,
    rOuterBottom,
    rOuterTop,
    rInnerBottom,
    rInnerTop,
    widthBottom,
    widthTop,
    polygonalSagitta,
    maxCurveBowOut,
    maxCurveBowIn,
    minRequiredThickness,
    stockThickness: tier.stockThickness,
    thicknessMargin,
    status,
    warningMessage,
    stripLengthPerStave,
    totalLinearLength,
    stripCuts,
  };
}
