import { describe, expect, it } from 'vitest';
import type { ProfilePoint, ShopSettings, StaveTierConfig } from '../../types/vessel';
import { buildProfileSampler } from '../spline';
import { calculateStaveTier } from '../stave';

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

describe('stave geometry', () => {
  it('matches vertical cylinder boundary: phi=0 => bevel=180/N, miter=0', () => {
    const vertical: ProfilePoint[] = [
      { id: 'p0', r: 4, y: 0, handleIn: { dr: 0, dy: 0 }, handleOut: { dr: 0, dy: 2 } },
      { id: 'p1', r: 4, y: 6, handleIn: { dr: 0, dy: -2 }, handleOut: { dr: 0, dy: 0 } },
    ];
    const sampler = buildProfileSampler(vertical, settings);
    const tier: StaveTierConfig = {
      id: 't1',
      index: 1,
      yBottom: 1,
      yTop: 5,
      staveCount: 12,
      stockThickness: 1.25,
      speciesPattern: ['walnut'],
    };

    const m = calculateStaveTier(tier, sampler, settings);
    expect(m.tiltAngleDeg).toBeCloseTo(0, 4);
    expect(m.bevelAngleDeg).toBeCloseTo(15, 4);
    expect(m.miterAngleDeg).toBeCloseTo(0, 4);
    expect(m.staveLength).toBeCloseTo(4, 4);
    expect(m.status).toBe('safe');
  });

  it('matches flat ring boundary: phi -> 90° => bevel -> 0°, miter -> 180/N', () => {
    const nearlyFlat: ProfilePoint[] = [
      { id: 'p0', r: 1, y: 0, handleIn: { dr: 0, dy: 0 }, handleOut: { dr: 1, dy: 0.0001 } },
      { id: 'p1', r: 10, y: 0.001, handleIn: { dr: -1, dy: -0.0001 }, handleOut: { dr: 0, dy: 0 } },
    ];
    const sampler = buildProfileSampler(nearlyFlat, {
      wallThickness: 0.25,
      baseThickness: 0.0001,
    });
    const tier: StaveTierConfig = {
      id: 't1',
      index: 1,
      yBottom: 0,
      yTop: 0.001,
      staveCount: 12,
      stockThickness: 1.0,
      speciesPattern: ['maple'],
    };

    const m = calculateStaveTier(tier, sampler, settings);
    expect(m.tiltAngleDeg).toBeGreaterThan(89.5);
    expect(m.bevelAngleDeg).toBeLessThan(0.1);
    expect(m.miterAngleDeg).toBeCloseTo(15, 1);
  });

  it('detects compound flared stave angles and flags insufficient stock for curved bow', () => {
    // Belly bowl that bulges outward in the middle
    const bellied: ProfilePoint[] = [
      { id: 'p0', r: 2.5, y: 0, handleIn: { dr: 0, dy: 0 }, handleOut: { dr: 2.5, dy: 2 } },
      { id: 'p1', r: 4.5, y: 6, handleIn: { dr: 1.5, dy: -2 }, handleOut: { dr: 0, dy: 0 } },
    ];
    const sampler = buildProfileSampler(bellied, settings);
    const thinStave: StaveTierConfig = {
      id: 't1',
      index: 1,
      yBottom: 0.5,
      yTop: 5.5,
      staveCount: 12,
      stockThickness: 0.75, // 4/4 dressed S4S is way too thin for deep belly!
      speciesPattern: ['cherry'],
    };

    const m = calculateStaveTier(thinStave, sampler, settings);
    expect(m.maxCurveBowOut).toBeGreaterThan(0.3);
    expect(m.minRequiredThickness).toBeGreaterThan(0.75);
    expect(m.status).toBe('error');
    expect(m.warningMessage).toBeTruthy();
  });
});
