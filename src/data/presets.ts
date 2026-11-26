import type { ShopSettings, VesselProject } from '../types/vessel';
import { DEFAULT_SPECIES } from './species';

export interface PresetDefinition {
  id: string;
  label: string;
  subtitle: string;
  createProject: () => VesselProject;
}

const BASE_SETTINGS: ShopSettings = {
  unit: 'in',
  displayMode: 'fraction',
  fractionPrecision: 32,
  sawKerf: 0.125,
  endTrimAllowance: 1.0,
  turningAllowanceOut: 0.125,
  turningAllowanceIn: 0.125,
  wallThickness: 0.45,
  baseThickness: 0.5,
};

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const VESSEL_PRESETS: PresetDefinition[] = [
  {
    id: 'classic-bowl',
    label: 'Classic Segmented Bowl',
    subtitle: '11" OD × 4.5" H · Closed Rings',
    createProject: () => ({
      schemaVersion: 1,
      id: makeId('proj'),
      name: 'Classic Segmented Bowl',
      updatedAt: new Date().toISOString(),
      mode: 'closed',
      settings: { ...BASE_SETTINGS },
      speciesLibrary: DEFAULT_SPECIES,
      profilePoints: [
        {
          id: 'p0',
          r: 2.5,
          y: 0,
          handleIn: { dr: 0, dy: 0 },
          handleOut: { dr: 1.4, dy: 0.9 },
        },
        {
          id: 'p1',
          r: 5.5,
          y: 4.5,
          handleIn: { dr: -0.35, dy: -1.8 },
          handleOut: { dr: 0, dy: 0 },
        },
      ],
      rings: [
        {
          id: 'r0',
          index: 0,
          isBaseDisk: true,
          height: 0.75,
          segments: 1,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 0,
          speciesPattern: ['walnut'],
        },
        {
          id: 'r1',
          index: 1,
          isBaseDisk: false,
          height: 0.75,
          segments: 16,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 0,
          speciesPattern: ['maple', 'walnut'],
        },
        {
          id: 'r2',
          index: 2,
          isBaseDisk: false,
          height: 0.75,
          segments: 16,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 11.25,
          speciesPattern: ['walnut', 'maple'],
        },
        {
          id: 'r3',
          index: 3,
          isBaseDisk: false,
          height: 0.75,
          segments: 16,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 0,
          speciesPattern: ['cherry'],
        },
        {
          id: 'r4',
          index: 4,
          isBaseDisk: false,
          height: 0.75,
          segments: 16,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 11.25,
          speciesPattern: ['maple', 'walnut'],
        },
        {
          id: 'r5',
          index: 5,
          isBaseDisk: false,
          height: 0.75,
          segments: 16,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 0,
          speciesPattern: ['walnut'],
        },
      ],
      staveTiers: [
        {
          id: 't1',
          index: 1,
          yBottom: 0.5,
          yTop: 4.5,
          staveCount: 12,
          stockThickness: 1.375,
          speciesPattern: ['walnut', 'maple'],
        },
      ],
      progress: {},
    }),
  },
  {
    id: 'flared-vase',
    label: 'Tall Flared Vase',
    subtitle: '7.5" OD × 9.5" H · Closed Rings',
    createProject: () => ({
      schemaVersion: 1,
      id: makeId('proj'),
      name: 'Tall Flared Vase',
      updatedAt: new Date().toISOString(),
      mode: 'closed',
      settings: { ...BASE_SETTINGS, wallThickness: 0.42 },
      speciesLibrary: DEFAULT_SPECIES,
      profilePoints: [
        {
          id: 'p0',
          r: 2.1,
          y: 0,
          handleIn: { dr: 0, dy: 0 },
          handleOut: { dr: 1.5, dy: 1.8 },
        },
        {
          id: 'p1',
          r: 3.75,
          y: 5.5,
          handleIn: { dr: 0.3, dy: -2.0 },
          handleOut: { dr: -0.4, dy: 1.6 },
        },
        {
          id: 'p2',
          r: 2.6,
          y: 9.5,
          handleIn: { dr: -0.6, dy: -1.3 },
          handleOut: { dr: 0, dy: 0 },
        },
      ],
      rings: [
        {
          id: 'r0',
          index: 0,
          isBaseDisk: true,
          height: 0.75,
          segments: 1,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 0,
          speciesPattern: ['walnut'],
        },
        ...Array.from({ length: 11 }, (_, idx) => {
          const ringNum = idx + 1;
          const isFeature = ringNum === 6;
          return {
            id: `r${ringNum}`,
            index: ringNum,
            isBaseDisk: false,
            height: ringNum === 11 ? 0.75 : 0.8,
            segments: 18,
            mode: 'closed' as const,
            gapDegrees: 0,
            rotationOffsetDeg: ringNum % 2 === 0 ? 10 : 0,
            speciesPattern: isFeature ? ['padauk', 'maple'] : ['cherry', 'walnut'],
          };
        }),
      ],
      staveTiers: [
        {
          id: 't1',
          index: 1,
          yBottom: 0.5,
          yTop: 5.5,
          staveCount: 16,
          stockThickness: 1.25,
          speciesPattern: ['cherry', 'walnut'],
        },
        {
          id: 't2',
          index: 2,
          yBottom: 5.5,
          yTop: 9.5,
          staveCount: 16,
          stockThickness: 1.25,
          speciesPattern: ['cherry', 'maple'],
        },
      ],
      progress: {},
    }),
  },
  {
    id: 'open-lantern',
    label: 'Open-Segment Lantern Bowl',
    subtitle: '10" OD × 5" H · 18-Seg Open',
    createProject: () => ({
      schemaVersion: 1,
      id: makeId('proj'),
      name: 'Open-Segment Lantern Bowl',
      updatedAt: new Date().toISOString(),
      mode: 'open',
      settings: { ...BASE_SETTINGS, wallThickness: 0.45 },
      speciesLibrary: DEFAULT_SPECIES,
      profilePoints: [
        {
          id: 'p0',
          r: 2.5,
          y: 0,
          handleIn: { dr: 0, dy: 0 },
          handleOut: { dr: 1.5, dy: 0.9 },
        },
        {
          id: 'p1',
          r: 5.0,
          y: 5.0,
          handleIn: { dr: -0.1, dy: -2.1 },
          handleOut: { dr: 0, dy: 0 },
        },
      ],
      rings: [
        {
          id: 'r0',
          index: 0,
          isBaseDisk: true,
          height: 0.75,
          segments: 1,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 0,
          speciesPattern: ['walnut'],
        },
        ...Array.from({ length: 6 }, (_, idx) => {
          const ringNum = idx + 1;
          const isRim = ringNum === 6;
          return {
            id: `r${ringNum}`,
            index: ringNum,
            isBaseDisk: false,
            height: 0.7,
            segments: 18,
            mode: isRim ? ('closed' as const) : ('open' as const),
            gapDegrees: isRim ? 0 : 4.5,
            rotationOffsetDeg: ringNum % 2 === 0 ? 10 : 0,
            speciesPattern: ringNum === 4 ? ['padauk'] : ['walnut', 'maple'],
          };
        }),
      ],
      staveTiers: [
        {
          id: 't1',
          index: 1,
          yBottom: 0.5,
          yTop: 5.0,
          staveCount: 12,
          stockThickness: 1.375,
          speciesPattern: ['walnut'],
        },
      ],
      progress: {},
    }),
  },
  {
    id: 'stave-urn',
    label: 'Tapered Stave Vessel',
    subtitle: '9" OD × 8" H · 12 Compound Staves',
    createProject: () => ({
      schemaVersion: 1,
      id: makeId('proj'),
      name: 'Tapered Stave Vessel',
      updatedAt: new Date().toISOString(),
      mode: 'stave',
      settings: { ...BASE_SETTINGS, wallThickness: 0.5 },
      speciesLibrary: DEFAULT_SPECIES,
      profilePoints: [
        {
          id: 'p0',
          r: 2.75,
          y: 0,
          handleIn: { dr: 0, dy: 0 },
          handleOut: { dr: 0.85, dy: 2.4 },
        },
        {
          id: 'p1',
          r: 4.5,
          y: 8.0,
          handleIn: { dr: -0.3, dy: -2.4 },
          handleOut: { dr: 0, dy: 0 },
        },
      ],
      rings: [
        {
          id: 'r0',
          index: 0,
          isBaseDisk: true,
          height: 0.75,
          segments: 1,
          mode: 'closed',
          gapDegrees: 0,
          rotationOffsetDeg: 0,
          speciesPattern: ['walnut'],
        },
        ...Array.from({ length: 8 }, (_, idx) => ({
          id: `r${idx + 1}`,
          index: idx + 1,
          isBaseDisk: false,
          height: 0.9,
          segments: 12,
          mode: 'closed' as const,
          gapDegrees: 0,
          rotationOffsetDeg: idx % 2 === 0 ? 15 : 0,
          speciesPattern: ['white-oak', 'walnut'],
        })),
      ],
      staveTiers: [
        {
          id: 't1',
          index: 1,
          yBottom: 0.5,
          yTop: 8.0,
          staveCount: 12,
          stockThickness: 1.5,
          speciesPattern: ['white-oak', 'walnut'],
        },
      ],
      progress: {},
    }),
  },
];

export function createPresetProject(presetId: string): VesselProject {
  const found = VESSEL_PRESETS.find((p) => p.id === presetId) ?? VESSEL_PRESETS[0]!;
  return found.createProject();
}
