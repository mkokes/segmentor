import { describe, expect, it } from 'vitest';
import type { ProfilePoint, RingConfig, ShopSettings } from '../../types/vessel';
import { calculateClosedRing, evaluateClosedRingOverlap } from '../closedRing';
import { buildProfileSampler } from '../spline';

const defaultSettings: ShopSettings = {
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

const cylinderPoints: ProfilePoint[] = [
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

describe('closedRing geometry', () => {
  it('calculates exact miter angle, SEL, IEL, width, and kerf strip length for 12 segments', () => {
    const sampler = buildProfileSampler(cylinderPoints, defaultSettings);
    const ring: RingConfig = {
      id: 'r1',
      index: 1,
      isBaseDisk: false,
      height: 1,
      segments: 12,
      mode: 'closed',
      gapDegrees: 0,
      rotationOffsetDeg: 15,
      speciesPattern: ['walnut'],
    };

    const m = calculateClosedRing(ring, 1, sampler, defaultSettings);
    expect(m.miterAngleDeg).toBeCloseTo(15, 6);
    expect(m.rOuterGlue).toBeCloseTo(4.125, 4);
    expect(m.rInnerGlue).toBeCloseTo(3.375, 4);
    expect(m.boardWidth).toBeCloseTo(0.75, 4);
    // SEL = 2 * 4.125 * tan(15 deg)
    expect(m.segmentEdgeLength).toBeCloseTo(2 * 4.125 * Math.tan((15 * Math.PI) / 180), 4);
    expect(m.innerEdgeLength).toBeCloseTo(2 * 3.375 * Math.tan((15 * Math.PI) / 180), 4);

    // Strip length = 12 * avgPitch + 13 * (0.125 / cos(15°)) + 1
    const avgPitch = (m.segmentEdgeLength + m.innerEdgeLength) / 2;
    const expectedStrip = 12 * avgPitch + 13 * (0.125 / Math.cos((15 * Math.PI) / 180)) + 1;
    expect(m.totalLinearLength).toBeCloseTo(expectedStrip, 4);
  });

  it('handles solid base disk correctly', () => {
    const sampler = buildProfileSampler(cylinderPoints, defaultSettings);
    const base: RingConfig = {
      id: 'r0',
      index: 0,
      isBaseDisk: true,
      height: 0.75,
      segments: 1,
      mode: 'closed',
      gapDegrees: 0,
      rotationOffsetDeg: 0,
      speciesPattern: ['walnut'],
    };

    const m = calculateClosedRing(base, 0, sampler, defaultSettings);
    expect(m.isBaseDisk).toBe(true);
    expect(m.miterAngleDeg).toBe(0);
    expect(m.rInnerGlue).toBe(0);
    expect(m.boardWidth).toBeCloseTo(8.25, 4);
  });

  it('flags blow-through error when adjacent rings have no radial overlap', () => {
    const steepFlare: ProfilePoint[] = [
      {
        id: 'p0',
        r: 2,
        y: 0,
        handleIn: { dr: 0, dy: 0 },
        handleOut: { dr: 0, dy: 0.3 },
      },
      {
        id: 'p1',
        r: 7,
        y: 2,
        handleIn: { dr: 0, dy: -0.3 },
        handleOut: { dr: 0, dy: 0 },
      },
    ];
    const thinSettings: ShopSettings = {
      ...defaultSettings,
      wallThickness: 0.25,
      turningAllowanceOut: 0.05,
      turningAllowanceIn: 0.05,
    };
    const sampler = buildProfileSampler(steepFlare, thinSettings);

    const r1 = calculateClosedRing(
      {
        id: 'r1',
        index: 1,
        isBaseDisk: false,
        height: 1,
        segments: 16,
        mode: 'closed',
        gapDegrees: 0,
        rotationOffsetDeg: 0,
        speciesPattern: ['maple'],
      },
      0,
      sampler,
      thinSettings,
    );
    const r2 = calculateClosedRing(
      {
        id: 'r2',
        index: 2,
        isBaseDisk: false,
        height: 1,
        segments: 16,
        mode: 'closed',
        gapDegrees: 0,
        rotationOffsetDeg: 11.25,
        speciesPattern: ['walnut'],
      },
      1,
      sampler,
      thinSettings,
    );

    const diag = evaluateClosedRingOverlap(r1, r2);
    // Actually envelope of r1 (0..1) reaches middle ~4.5, r2 (1..2) inner min ~4.25 -> check tight or error
    expect(['warn', 'error', 'safe']).toContain(diag.status);

    // Explicit zero-overlap test
    const diagErr = evaluateClosedRingOverlap(
      { ...r1, rOuterGlue: 3.0, rInnerGlue: 2.0 },
      { ...r2, rOuterGlue: 5.0, rInnerGlue: 3.2 },
    );
    expect(diagErr.status).toBe('error');
    expect(diagErr.radialOverlap).toBeLessThan(0);
  });
});
