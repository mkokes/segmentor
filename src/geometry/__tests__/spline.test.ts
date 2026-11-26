import { describe, expect, it } from 'vitest';
import type { ProfilePoint } from '../../types/vessel';
import { buildProfileSampler } from '../spline';

describe('spline profile sampler', () => {
  it('samples a straight vertical cylinder with exact wall thickness offset', () => {
    const cylinder: ProfilePoint[] = [
      {
        id: 'p0',
        r: 4,
        y: 0,
        handleIn: { dr: 0, dy: 0 },
        handleOut: { dr: 0, dy: 2 },
      },
      {
        id: 'p1',
        r: 4,
        y: 6,
        handleIn: { dr: 0, dy: -2 },
        handleOut: { dr: 0, dy: 0 },
      },
    ];

    const sampler = buildProfileSampler(cylinder, {
      wallThickness: 0.5,
      baseThickness: 0.5,
    });

    expect(sampler.height).toBeCloseTo(6, 5);
    expect(sampler.rOuterAtY(3)).toBeCloseTo(4, 4);
    expect(sampler.rInnerAtY(0.2)).toBe(0); // below baseThickness -> solid bottom
    expect(sampler.rInnerAtY(3)).toBeCloseTo(3.5, 4);
  });

  it('computes envelope min/max over a flared bowl segment', () => {
    const flared: ProfilePoint[] = [
      {
        id: 'p0',
        r: 2,
        y: 0,
        handleIn: { dr: 0, dy: 0 },
        handleOut: { dr: 0.5, dy: 1 },
      },
      {
        id: 'p1',
        r: 5,
        y: 4,
        handleIn: { dr: -0.5, dy: -1 },
        handleOut: { dr: 0, dy: 0 },
      },
    ];

    const sampler = buildProfileSampler(flared, {
      wallThickness: 0.375,
      baseThickness: 0.5,
    });

    const env = sampler.sampleEnvelope(1, 3);
    expect(env.rOuterMax).toBeGreaterThan(env.rOuterMin);
    expect(env.rInnerMin).toBeLessThan(env.rOuterMin);
  });
});
