export type UnitSystem = 'in' | 'mm';
export type UnitDisplayMode = 'decimal' | 'fraction';
export type FractionPrecision = 16 | 32 | 64;
export type VesselMode = 'closed' | 'open' | 'stave';
export type SafetyStatus = 'safe' | 'warn' | 'error';

export interface ProfilePoint {
  id: string;
  r: number; // outer radius in canonical inches
  y: number; // height from base in canonical inches
  handleIn: { dr: number; dy: number };
  handleOut: { dr: number; dy: number };
}

export interface WoodSpecies {
  id: string;
  name: string;
  colorHex: string;
  secondaryHex: string;
  costPerBoardFoot?: number;
}

export interface RingConfig {
  id: string;
  index: number; // 0 = base disk, 1..M = segmented rings
  isBaseDisk: boolean;
  height: number; // inches
  segments: number; // N >= 3 (ignored when isBaseDisk === true)
  mode: 'closed' | 'open';
  gapDegrees: number; // open-segment gap angle per joint (degrees)
  rotationOffsetDeg: number; // angular offset relative to 0° (e.g. half-segment brick stagger)
  speciesPattern: string[]; // WoodSpecies.id sequence cycled around the ring
}

export interface StaveTierConfig {
  id: string;
  index: number;
  yBottom: number; // inches
  yTop: number; // inches
  staveCount: number; // N >= 3
  stockThickness: number; // milled lumber thickness in inches
  speciesPattern: string[];
}

export interface ShopSettings {
  unit: UnitSystem;
  displayMode: UnitDisplayMode;
  fractionPrecision: FractionPrecision;
  sawKerf: number; // inches (e.g. 0.125" standard, 0.09375" thin-kerf)
  endTrimAllowance: number; // extra length per strip in inches
  turningAllowanceOut: number; // extra outer radius in inches
  turningAllowanceIn: number; // extra inner wall allowance in inches
  wallThickness: number; // finished vessel wall thickness in inches
  baseThickness: number; // finished vessel floor thickness in inches
}

export interface RingProgress {
  cut: boolean;
  dryFit: boolean;
  glued: boolean;
  flattened: boolean;
  notes?: string;
}

export interface VesselProject {
  schemaVersion: 1;
  id: string;
  name: string;
  updatedAt: string;
  mode: VesselMode;
  profilePoints: ProfilePoint[];
  settings: ShopSettings;
  speciesLibrary: WoodSpecies[];
  rings: RingConfig[];
  staveTiers: StaveTierConfig[];
  progress: Record<string, RingProgress>;
}

export interface SampledProfilePoint {
  y: number;
  rOuter: number;
  rInner: number;
}

export interface ProfileEnvelope {
  rOuterMax: number;
  rOuterMin: number;
  rInnerMin: number;
  rInnerMax: number;
}

export interface StripCutSpec {
  speciesId: string;
  segmentCount: number;
  stripLength: number; // inches, kerf-compensated + endTrim
}

export interface RingGeometryMetrics {
  ringId: string;
  index: number;
  isBaseDisk: boolean;
  mode: 'closed' | 'open';
  yBottom: number;
  yTop: number;
  height: number;
  segments: number;
  miterAngleDeg: number; // cut angle per end of segment (0 for base disk)
  gapDegrees: number; // 0 for closed / base disk
  openPercent: number; // 0 for closed / base disk
  indexingAngleDeg: number; // 360 / N (0 for base disk)
  rOuterFinishedMax: number;
  rInnerFinishedMin: number;
  rOuterGlue: number; // inscribed outer radius (or disk radius)
  rOuterVertex: number; // circumscribed vertex radius (corner to corner / 2)
  rInnerGlue: number;
  segmentEdgeLength: number; // SEL (outer chord)
  innerEdgeLength: number; // IEL (inner chord)
  boardWidth: number; // radial strip width W = rOuterGlue - rInnerGlue (or 2 * rOuterGlue for base disk)
  gapWidthInner: number;
  gapWidthOuter: number;
  stripCuts: StripCutSpec[];
  totalLinearLength: number;
}

export interface RingOverlapDiagnostic {
  lowerRingId: string;
  upperRingId: string;
  lowerIndex: number;
  upperIndex: number;
  radialOverlap: number; // inches
  verticalBondRatio: number; // 0..1 (relevant for open-segment stagger)
  status: SafetyStatus;
  message: string;
}

export interface StaveTierMetrics {
  tierId: string;
  index: number;
  yBottom: number;
  yTop: number;
  tierHeight: number;
  staveCount: number;
  staveLength: number; // length along the tilted face
  tiltAngleDeg: number; // angle from vertical (phi)
  bevelAngleDeg: number; // table saw blade tilt from 90° (beta)
  miterAngleDeg: number; // table saw miter gauge from 90° (gamma)
  rOuterBottom: number; // includes turningAllowanceOut
  rOuterTop: number;
  rInnerBottom: number; // includes turningAllowanceIn
  rInnerTop: number;
  widthBottom: number; // outer stave width at bottom
  widthTop: number; // outer stave width at top
  polygonalSagitta: number; // corner drop R_o * (sec(theta) - 1)
  maxCurveBowOut: number; // max outward bulge of finished curve above chord
  maxCurveBowIn: number; // max inward dip of inner curve below inner chord
  minRequiredThickness: number; // minimum milled stock thickness needed
  stockThickness: number;
  thicknessMargin: number; // stockThickness - minRequiredThickness
  status: SafetyStatus;
  warningMessage: string | null;
  stripLengthPerStave: number;
  totalLinearLength: number;
  stripCuts: StripCutSpec[];
}

export interface SpeciesStockItem {
  speciesId: string;
  speciesName: string;
  colorHex: string;
  thickness: number; // inches
  width: number; // inches
  totalLinearInches: number;
  boardFeet: number;
  pieceCount: number;
}

export interface SpeciesTotalsSummary {
  items: SpeciesStockItem[];
  bySpecies: Record<
    string,
    {
      speciesId: string;
      speciesName: string;
      colorHex: string;
      totalLinearInches: number;
      totalBoardFeet: number;
      estimatedCost: number | null;
    }
  >;
  grandTotalBoardFeet: number;
  grandTotalLinearInches: number;
}
