import type { WoodSpecies } from '../types/vessel';

export const DEFAULT_SPECIES: WoodSpecies[] = [
  {
    id: 'maple',
    name: 'Hard Maple',
    colorHex: '#ebd8b7',
    secondaryHex: '#d9be94',
    costPerBoardFoot: 7.5,
  },
  {
    id: 'walnut',
    name: 'Black Walnut',
    colorHex: '#593b28',
    secondaryHex: '#3f281a',
    costPerBoardFoot: 11.5,
  },
  {
    id: 'cherry',
    name: 'American Cherry',
    colorHex: '#b25e3b',
    secondaryHex: '#8d4327',
    costPerBoardFoot: 8.5,
  },
  {
    id: 'padauk',
    name: 'African Padauk',
    colorHex: '#c84b24',
    secondaryHex: '#9d3214',
    costPerBoardFoot: 14.0,
  },
  {
    id: 'purpleheart',
    name: 'Purpleheart',
    colorHex: '#6c3b64',
    secondaryHex: '#4f2749',
    costPerBoardFoot: 13.5,
  },
  {
    id: 'wenge',
    name: 'Wenge',
    colorHex: '#2e221b',
    secondaryHex: '#1b130f',
    costPerBoardFoot: 17.0,
  },
  {
    id: 'white-oak',
    name: 'White Oak',
    colorHex: '#c6a577',
    secondaryHex: '#a98556',
    costPerBoardFoot: 8.0,
  },
  {
    id: 'yellowheart',
    name: 'Yellowheart',
    colorHex: '#d8ad3e',
    secondaryHex: '#b88d25',
    costPerBoardFoot: 12.0,
  },
];

export function findSpecies(speciesLibrary: WoodSpecies[], speciesId: string): WoodSpecies {
  return (
    speciesLibrary.find((s) => s.id === speciesId) ??
    DEFAULT_SPECIES[0] ?? {
      id: speciesId,
      name: speciesId,
      colorHex: '#c8843e',
      secondaryHex: '#8f5420',
    }
  );
}
