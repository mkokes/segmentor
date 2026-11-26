import { findSpecies } from '../data/species';
import type {
  RingGeometryMetrics,
  SpeciesStockItem,
  SpeciesTotalsSummary,
  StaveTierMetrics,
  WoodSpecies,
} from '../types/vessel';

export function computeBoardFeet(
  thicknessInches: number,
  widthInches: number,
  lengthInches: number,
): number {
  return (thicknessInches * widthInches * lengthInches) / 144;
}

export function summarizeRingSpeciesStock(
  rings: RingGeometryMetrics[],
  speciesLibrary: WoodSpecies[],
): SpeciesTotalsSummary {
  const bucketMap = new Map<string, SpeciesStockItem>();

  for (const ring of rings) {
    for (const cut of ring.stripCuts) {
      const species = findSpecies(speciesLibrary, cut.speciesId);
      const thicknessKey = ring.height.toFixed(3);
      const widthKey = ring.boardWidth.toFixed(3);
      const key = `${cut.speciesId}::${thicknessKey}::${widthKey}`;

      const bf = computeBoardFeet(ring.height, ring.boardWidth, cut.stripLength);
      const existing = bucketMap.get(key);
      if (existing) {
        existing.totalLinearInches += cut.stripLength;
        existing.boardFeet += bf;
        existing.pieceCount += cut.segmentCount;
      } else {
        bucketMap.set(key, {
          speciesId: cut.speciesId,
          speciesName: species.name,
          colorHex: species.colorHex,
          thickness: ring.height,
          width: ring.boardWidth,
          totalLinearInches: cut.stripLength,
          boardFeet: bf,
          pieceCount: cut.segmentCount,
        });
      }
    }
  }

  return finalizeSummary(Array.from(bucketMap.values()), speciesLibrary);
}

export function summarizeStaveSpeciesStock(
  tiers: StaveTierMetrics[],
  speciesLibrary: WoodSpecies[],
): SpeciesTotalsSummary {
  const bucketMap = new Map<string, SpeciesStockItem>();

  for (const tier of tiers) {
    const maxWidth = Math.max(tier.widthBottom, tier.widthTop);
    for (const cut of tier.stripCuts) {
      const species = findSpecies(speciesLibrary, cut.speciesId);
      const thicknessKey = tier.stockThickness.toFixed(3);
      const widthKey = maxWidth.toFixed(3);
      const key = `${cut.speciesId}::${thicknessKey}::${widthKey}`;

      const bf = computeBoardFeet(tier.stockThickness, maxWidth, cut.stripLength);
      const existing = bucketMap.get(key);
      if (existing) {
        existing.totalLinearInches += cut.stripLength;
        existing.boardFeet += bf;
        existing.pieceCount += cut.segmentCount;
      } else {
        bucketMap.set(key, {
          speciesId: cut.speciesId,
          speciesName: species.name,
          colorHex: species.colorHex,
          thickness: tier.stockThickness,
          width: maxWidth,
          totalLinearInches: cut.stripLength,
          boardFeet: bf,
          pieceCount: cut.segmentCount,
        });
      }
    }
  }

  return finalizeSummary(Array.from(bucketMap.values()), speciesLibrary);
}

function finalizeSummary(
  items: SpeciesStockItem[],
  speciesLibrary: WoodSpecies[],
): SpeciesTotalsSummary {
  const bySpecies: SpeciesTotalsSummary['bySpecies'] = {};
  let grandTotalBoardFeet = 0;
  let grandTotalLinearInches = 0;

  for (const item of items) {
    grandTotalBoardFeet += item.boardFeet;
    grandTotalLinearInches += item.totalLinearInches;

    const species = findSpecies(speciesLibrary, item.speciesId);
    const existing = bySpecies[item.speciesId];
    if (existing) {
      existing.totalLinearInches += item.totalLinearInches;
      existing.totalBoardFeet += item.boardFeet;
      existing.estimatedCost =
        species.costPerBoardFoot !== undefined
          ? existing.totalBoardFeet * species.costPerBoardFoot
          : null;
    } else {
      bySpecies[item.speciesId] = {
        speciesId: item.speciesId,
        speciesName: species.name,
        colorHex: species.colorHex,
        totalLinearInches: item.totalLinearInches,
        totalBoardFeet: item.boardFeet,
        estimatedCost:
          species.costPerBoardFoot !== undefined ? item.boardFeet * species.costPerBoardFoot : null,
      };
    }
  }

  return {
    items,
    bySpecies,
    grandTotalBoardFeet,
    grandTotalLinearInches,
  };
}
