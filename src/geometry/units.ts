import type { FractionPrecision, UnitDisplayMode, UnitSystem } from '../types/vessel';

export const MM_PER_INCH = 25.4;

export function toInches(value: number, unit: UnitSystem): number {
  if (!Number.isFinite(value)) return 0;
  return unit === 'mm' ? value / MM_PER_INCH : value;
}

export function fromInches(inches: number, unit: UnitSystem): number {
  if (!Number.isFinite(inches)) return 0;
  return unit === 'mm' ? inches * MM_PER_INCH : inches;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

export function formatInchesAsFraction(inches: number, precision: FractionPrecision = 32): string {
  if (!Number.isFinite(inches)) return '0"';
  const sign = inches < 0 ? '-' : '';
  const abs = Math.abs(inches);
  let whole = Math.floor(abs);
  let numerator = Math.round((abs - whole) * precision);

  if (numerator >= precision) {
    whole += 1;
    numerator = 0;
  }

  if (numerator === 0) {
    return `${sign}${whole}"`;
  }

  const divisor = gcd(numerator, precision);
  const reducedNum = numerator / divisor;
  const reducedDen = precision / divisor;

  if (whole === 0) {
    return `${sign}${reducedNum}/${reducedDen}"`;
  }
  return `${sign}${whole} ${reducedNum}/${reducedDen}"`;
}

export function formatDimension(
  inches: number,
  unit: UnitSystem,
  displayMode: UnitDisplayMode = 'decimal',
  precision: FractionPrecision = 32,
  decimals?: number,
): string {
  if (!Number.isFinite(inches)) return unit === 'mm' ? '0 mm' : '0"';

  if (unit === 'mm') {
    const mm = fromInches(inches, 'mm');
    const dp = decimals ?? 1;
    return `${mm.toFixed(dp)} mm`;
  }

  if (displayMode === 'fraction') {
    return formatInchesAsFraction(inches, precision);
  }

  const dp = decimals ?? 3;
  return `${inches.toFixed(dp)}"`;
}

export function formatAngle(degrees: number, decimals = 2): string {
  if (!Number.isFinite(degrees)) return '0.00°';
  return `${degrees.toFixed(decimals)}°`;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}
