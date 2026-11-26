import { describe, expect, it } from 'vitest';
import { createPresetProject, VESSEL_PRESETS } from '../../data/presets';
import { evaluateVessel } from '../vesselMetrics';

describe('vesselMetrics & built-in presets', () => {
  it('evaluates every built-in preset cleanly with zero geometry errors', () => {
    for (const preset of VESSEL_PRESETS) {
      const project = createPresetProject(preset.id);
      const evaluated = evaluateVessel(project);

      expect(evaluated.profileHeight).toBeGreaterThan(2);
      expect(evaluated.maxOuterDiameter).toBeGreaterThan(4);
      expect(evaluated.speciesSummary.grandTotalBoardFeet).toBeGreaterThan(0);
      expect(evaluated.errorCount).toBe(0);
    }
  });
});
