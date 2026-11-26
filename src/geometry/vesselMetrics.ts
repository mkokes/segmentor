import type {
  RingGeometryMetrics,
  RingOverlapDiagnostic,
  SpeciesTotalsSummary,
  StaveTierMetrics,
  VesselProject,
} from '../types/vessel';
import { calculateClosedRing } from './closedRing';
import { calculateOpenRing, evaluateRingPairOverlap } from './openRing';
import { summarizeRingSpeciesStock, summarizeStaveSpeciesStock } from './speciesSummary';
import { buildProfileSampler, type ProfileSampler } from './spline';
import { calculateStaveTier } from './stave';

export interface EvaluatedVessel {
  sampler: ProfileSampler;
  profileHeight: number;
  maxOuterDiameter: number;
  ringMetrics: RingGeometryMetrics[];
  ringOverlaps: RingOverlapDiagnostic[];
  staveMetrics: StaveTierMetrics[];
  speciesSummary: SpeciesTotalsSummary;
  errorCount: number;
  warningCount: number;
}

export function evaluateVessel(project: VesselProject): EvaluatedVessel {
  const sampler = buildProfileSampler(project.profilePoints, project.settings);
  const maxOuterRadius = sampler.samples.reduce((max, s) => Math.max(max, s.rOuter), 0);

  // Evaluate stacked rings sequentially from y = 0
  const ringMetrics: RingGeometryMetrics[] = [];
  let cursorY = 0;
  for (const ring of project.rings) {
    const metrics =
      !ring.isBaseDisk && ring.mode === 'open'
        ? calculateOpenRing(ring, cursorY, sampler, project.settings)
        : calculateClosedRing(ring, cursorY, sampler, project.settings);
    ringMetrics.push(metrics);
    cursorY += ring.height;
  }

  const ringOverlaps: RingOverlapDiagnostic[] = [];
  for (let i = 0; i < ringMetrics.length - 1; i++) {
    const lower = ringMetrics[i]!;
    const upper = ringMetrics[i + 1]!;
    const lowerCfg = project.rings[i]!;
    const upperCfg = project.rings[i + 1]!;
    ringOverlaps.push(
      evaluateRingPairOverlap(lower, lowerCfg.rotationOffsetDeg, upper, upperCfg.rotationOffsetDeg),
    );
  }

  const staveMetrics: StaveTierMetrics[] = project.staveTiers.map((tier) =>
    calculateStaveTier(tier, sampler, project.settings),
  );

  const speciesSummary =
    project.mode === 'stave'
      ? summarizeStaveSpeciesStock(staveMetrics, project.speciesLibrary)
      : summarizeRingSpeciesStock(ringMetrics, project.speciesLibrary);

  let errorCount = 0;
  let warningCount = 0;
  if (project.mode === 'stave') {
    for (const tier of staveMetrics) {
      if (tier.status === 'error') errorCount += 1;
      else if (tier.status === 'warn') warningCount += 1;
    }
  } else {
    for (const overlap of ringOverlaps) {
      if (overlap.status === 'error') errorCount += 1;
      else if (overlap.status === 'warn') warningCount += 1;
    }
  }

  return {
    sampler,
    profileHeight: sampler.height,
    maxOuterDiameter: maxOuterRadius * 2,
    ringMetrics,
    ringOverlaps,
    staveMetrics,
    speciesSummary,
    errorCount,
    warningCount,
  };
}
