import { describe, expect, it } from 'vitest';
import { DEFAULT_SPECIES } from '../../data/species';
import type { ProfilePoint, RingConfig, ShopSettings } from '../../types/vessel';
import { calculateClosedRing } from '../closedRing';
import { computeBoardFeet, summarizeRingSpeciesStock } from '../speciesSummary';
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
  { id: 'p0', r: 4, y: 0, handleIn: { dr: 0, dy: 0 }, handleOut: { dr: 0, dy: 1 } },
  { id: 'p1', r: 4, y: 4, handleIn: { dr: 0, dy: -1 }, handleOut: { dr: 0, dy: 0 } },
];

describe('speciesSummary', () => {
  it('computes board feet accurately', () => {
    // 1" x 12" x 12" = 1.0 BF
    expect(computeBoardFeet(1, 12, 12)).toBeCloseTo(1, 6);
  });

  it('aggregates alternating species across multiple rings', () => {
    const sampler = buildProfileSampler(cylinder, settings);
    const ringTemplate: Omit<RingConfig, 'id' | 'index'> = {
      isBaseDisk: false,
      height: 1,
      segments: 12,
      mode: 'closed',
      gapDegrees: 0,
      rotationOffsetDeg: 0,
      speciesPattern: ['walnut', 'maple'],
    };

    const r1 = calculateClosedRing({ ...ringTemplate, id: 'r1', index: 1 }, 1, sampler, settings);
    const r2 = calculateClosedRing({ ...ringTemplate, id: 'r2', index: 2 }, 2, sampler, settings);

    const summary = summarizeRingSpeciesStock([r1, r2], DEFAULT_SPECIES);
    expect(summary.bySpecies.walnut?.totalLinearInches).toBeGreaterThan(0);
    expect(summary.bySpecies.maple?.totalLinearInches).toBeCloseTo(
      summary.bySpecies.walnut?.totalLinearInches ?? 0,
      4,
    );
    expect(summary.grandTotalBoardFeet).toBeGreaterThan(0);
  });
});
