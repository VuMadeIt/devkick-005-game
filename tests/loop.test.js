import { describe, expect, it } from 'vitest';
import { STEP, stepsFor } from '../src/game/loop.js';

describe('fixed-step loop', () => {
  it('runs 2 steps for one 60 fps frame', () => {
    expect(stepsFor(0, 1 / 60 + 1e-9).steps).toBe(2);
  });

  it('carries leftover time to the next frame', () => {
    const r = stepsFor(0, STEP * 1.5);
    expect(r.steps).toBe(1);
    expect(r.accumulator).toBeCloseTo(STEP * 0.5);
  });

  it('caps a long hitch so the game does not spiral', () => {
    expect(stepsFor(0, 10).steps).toBe(30); // 0.25 s * 120 Hz
  });
});
