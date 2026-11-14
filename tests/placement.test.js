import { describe, expect, it } from 'vitest';
import { band, clampTrust, placement, trustDelta } from '../src/game/placement.js';
import scotland from '../src/content/scotland.json';

describe('placement test rules', () => {
  it('bands scores', () => {
    expect(band(0.9)).toBe('good');
    expect(band(0.5)).toBe('ok');
    expect(band(0.1)).toBe('bad');
  });

  it('moves trust up for good answers and down for bad ones', () => {
    expect(trustDelta(1)).toBeGreaterThan(0);
    expect(trustDelta(0)).toBeLessThan(0);
    expect(clampTrust(150)).toBe(100);
  });

  it('places a perfect run as Local and silence as Tourist', () => {
    expect(placement([1, 1, 1], scotland.path).level.name).toBe('Local');
    expect(placement([0, 0, 0], scotland.path).level.name).toBe('Tourist');
  });

  it('has a reaction for every band on every line', () => {
    for (const item of scotland.test) {
      for (const b of ['good', 'ok', 'bad']) expect(item.reactions[b].text).toBeTruthy();
    }
  });
});
