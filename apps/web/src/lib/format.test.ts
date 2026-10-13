import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatInrPerT,
  formatPercent,
  formatTonnes,
  formatUsdPerT,
} from './format';

describe('unit-explicit display formatting', () => {
  it('formats domestic price in Indian grouping and retains INR/t', () => {
    expect(formatInrPerT(5_000_000)).toBe('₹50,00,000/t');
  });

  it('formats international benchmark and quantity with units', () => {
    expect(formatUsdPerT(367.437)).toBe('US$367.44/t');
    expect(formatTonnes(250.5)).toBe('250.5 t');
  });

  it('uses one decimal for percentages', () => {
    expect(formatPercent(0.021)).toBe('2.1%');
  });

  it('formats business dates consistently and handles missing dates', () => {
    expect(formatDate('2026-10-12')).toBe('12 Oct 2026');
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });
});
