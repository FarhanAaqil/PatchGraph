import { describe, expect, it } from 'vitest';
import { findNavItem, NAV_ITEMS } from './nav';

describe('navigation', () => {
  it('has unique paths and labels', () => {
    expect(new Set(NAV_ITEMS.map((i) => i.path)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((i) => i.label)).size).toBe(NAV_ITEMS.length);
  });

  it('numbers the four workflow steps 1 to 4 in order', () => {
    const steps = NAV_ITEMS.filter((i) => i.step).map((i) => [i.step, i.label]);
    expect(steps).toEqual([
      [1, 'Import'],
      [2, 'Risks'],
      [3, 'Plan'],
      [4, 'Review'],
    ]);
  });

  it('finds the current page, including nested addresses, and falls back to Home', () => {
    expect(findNavItem('/risks').label).toBe('Risks');
    expect(findNavItem('/risks/anything').label).toBe('Risks');
    expect(findNavItem('/nope').label).toBe('Home');
  });
});
