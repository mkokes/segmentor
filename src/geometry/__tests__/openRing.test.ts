import { describe, expect, it } from 'vitest';
import type { ProfilePoint, RingConfig, ShopSettings } from '../../types/vessel';
import {
  calculateOpenRing,
  computeVerticalArcBondRatio,
  evaluateRingPairOverlap,
  gapDegreesFromOpenPercent,
  openPercentFromGapDegrees,
} from '../openRing';
import { buildProfileSampler } from '../spline';

const settings: ShopSettings = {
  unit: 'in',
  displayMode: 'decimal',
  fractionPrecision: 32,
  sawKerf: 0.125,
  endTrimAllowance: 1,
  turningAllowanceOut: 0.125,
  turningAllowanceIn: 0.125,
  wallThickness: 0.5,
  baseThickness: 0.5,
};

const cylinder: ProfilePoint[] = [
  {
    id: 'p0',
    r: 4,
    y: 0,
    handleIn: { dr: 0, dy: 0 },
    handleOut: { dr: 0, dy: 1 },
  },
  {
    id: 'p1',
    r: 4,
    y: 4,
    handleIn: { dr: 0, dy: -1 },
    handleOut: { dr: 0, dy: 0 },
  },
];

describe('openRing geometry', () => {
  it('converts between gapDegrees and openPercent symmetrically', () => {
    // 18 segments => 20° pitch; 25% open => 5° gap
    expect(gapDegreesFromOpenPercent(18, 25)).toBeCloseTo(5, 6);
    expect(openPercentFromGapDegrees(18, 5)).toBeCloseTo(25, 6);
  });

  it('computes open-segment miter angle, SEL, and gap clearance', () => {
    const sampler = buildProfileSampler(cylinder, settings);
    const ring: RingConfig = {
      id: 'open1',
      index: 1,
      isBaseDisk: false,
      height: 0.75,
      segments: 18,
      mode: 'open',
      gapDegrees: 6, // pitch 20°, sweep 14°, miter 7°
      rotationOffsetDeg: 0,
      speciesPattern: ['cherry'],
    };

    const m = calculateOpenRing(ring, 1, sampler, settings);
    expect(m.indexingAngleDeg).toBeCloseTo(20, 6);
    expect(m.miterAngleDeg).toBeCloseTo(7, 6);
    expect(m.segmentEdgeLength).toBeCloseTo(2 * 4.125 * Math.tan((7 * Math.PI) / 180), 4);
    expect(m.gapWidthOuter).toBeCloseTo(2 * 4.125 * Math.sin((3 * Math.PI) / 180), 4);
    expect(m.gapWidthInner).toBeCloseTo(2 * 3.375 * Math.sin((3 * Math.PI) / 180), 4);
  });

  it('evaluates staggered open-segment vertical arc bond ratio', () => {
    const sampler = buildProfileSampler(cylinder, settings);
    const baseRing = {
      id: 'o1',
      index: 1,
      isBaseDisk: false,
      height: 0.75,
      segments: 12, // 30° pitch
      mode: 'open' as const,
      gapDegrees: 6, // 24° solid, 6° gap
      rotationOffsetDeg: 0,
      speciesPattern: ['maple'],
    };
    const m1 = calculateOpenRing(baseRing, 1, sampler, settings);
    const m2 = calculateOpenRing({ ...baseRing, id: 'o2', index: 2 }, 1.75, sampler, settings);

    // Staggered by 15° (half segment): each 24° arc overlaps two arcs on lower ring with one 6° gap inside -> 18/24 = 75%
    const ratio = computeVerticalArcBondRatio(m1, 0, m2, 15);
    expect(ratio).toBeCloseTo(0.75, 4);

    // Huge gap (65% open -> 19.5° gap, 10.5° solid): staggered 15° has 0% overlap!
    const wideGap = { ...baseRing, gapDegrees: 19.5 };
    const w1 = calculateOpenRing(wideGap, 1, sampler, settings);
    const w2 = calculateOpenRing({ ...wideGap, id: 'o2', index: 2 }, 1.75, sampler, settings);
    const diag = evaluateRingPairOverlap(w1, 0, w2, 15);
    expect(diag.verticalBondRatio).toBeCloseTo(0, 4);
    expect(diag.status).toBe('error');
  });
});
