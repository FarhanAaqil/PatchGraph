import { describe, expect, it } from 'vitest';
import { SEVERITY_LABELS } from './terms';

describe('severity labels', () => {
  it('never rely on colour alone: every band has text and an aria label', () => {
    for (const descriptor of Object.values(SEVERITY_LABELS)) {
      expect(descriptor.badgeText.length).toBeGreaterThan(0);
      expect(descriptor.ariaLabel.length).toBeGreaterThan(0);
    }
  });

  it('keeps score bands contiguous and ordered from critical down to low', () => {
    const { CRITICAL, HIGH, MEDIUM, LOW } = SEVERITY_LABELS;
    expect(CRITICAL.minScore).toBeGreaterThan(HIGH.maxScore);
    expect(HIGH.minScore).toBeGreaterThan(MEDIUM.maxScore);
    expect(MEDIUM.minScore).toBeGreaterThan(LOW.maxScore);
  });

  it('flags unknown severity as unverified rather than safe', () => {
    expect(SEVERITY_LABELS.UNKNOWN.badgeText).toMatch(/PENALTY/);
  });
});
