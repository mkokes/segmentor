import { describe, expect, it } from 'vitest';
import {
  formatAngle,
  formatDimension,
  formatInchesAsFraction,
  fromInches,
  toInches,
} from '../units';

describe('units', () => {
  it('converts cleanly between inches and millimeters', () => {
    expect(toInches(25.4, 'mm')).toBeCloseTo(1, 6);
    expect(fromInches(2, 'mm')).toBeCloseTo(50.8, 6);
    expect(toInches(3.5, 'in')).toBe(3.5);
  });

  it('formats inches as reduced fractions and handles carry-up', () => {
    expect(formatInchesAsFraction(1.375, 16)).toBe('1 3/8"');
    expect(formatInchesAsFraction(0.0625, 16)).toBe('1/16"');
    expect(formatInchesAsFraction(1.999, 16)).toBe('2"');
    expect(formatInchesAsFraction(-0.25, 32)).toBe('-1/4"');
  });

  it('formats dimensions in decimal, fractional, and metric modes', () => {
    expect(formatDimension(1.5, 'in', 'decimal', 32, 3)).toBe('1.500"');
    expect(formatDimension(1.5, 'in', 'fraction', 32)).toBe('1 1/2"');
    expect(formatDimension(1, 'mm', 'decimal', 32, 1)).toBe('25.4 mm');
  });

  it('formats angles cleanly', () => {
    expect(formatAngle(11.25)).toBe('11.25°');
    expect(formatAngle(15, 1)).toBe('15.0°');
  });
});
