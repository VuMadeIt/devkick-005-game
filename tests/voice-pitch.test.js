import { describe, expect, it } from 'vitest';
import { accent, contour, detectPitch, dtw, resample, semitones } from '../src/voice/pitch.js';

const SR = 16000;
// Tone whose pitch follows hzAt(t), t in 0..1 over `secs`.
function tone(hzAt, secs = 1) {
  const out = new Float32Array(Math.round(SR * secs));
  let phase = 0;
  for (let i = 0; i < out.length; i += 1) {
    phase += (2 * Math.PI * hzAt(i / out.length)) / SR;
    out[i] = 0.5 * Math.sin(phase);
  }
  return out;
}

describe('pitch detection', () => {
  it('finds the pitch of a sine wave', () => {
    for (const hz of [110, 220, 330]) {
      expect(detectPitch(tone(() => hz, 0.05), SR)).toBeCloseTo(hz, 0);
    }
  });

  it('calls silence unvoiced', () => {
    expect(detectPitch(new Float32Array(800), SR)).toBe(0);
    expect(contour(new Float32Array(SR / 2), SR).hz.every((f) => f === 0)).toBe(true);
  });

  it('tracks a rising tone frame by frame', () => {
    const { hz } = contour(tone((t) => 150 + 100 * t), SR);
    expect(hz[5]).toBeLessThan(hz[hz.length - 5]);
  });
});

describe('normalisation', () => {
  it('drops unvoiced frames and centres on the median', () => {
    expect(semitones([0, 100, 200, 0, 400])).toEqual([-12, 0, 12]);
  });

  it('resamples to a fixed length', () => {
    const r = resample([0, 10]);
    expect(r).toHaveLength(60);
    expect(r[0]).toBe(0);
    expect(r[59]).toBe(10);
  });
});

describe('dtw', () => {
  it('is 0 for the same contour, even at a different tempo', () => {
    expect(dtw([0, 1, 2, 1], [0, 1, 2, 1])).toBe(0);
    expect(dtw([0, 1, 2, 1], [0, 0, 1, 1, 2, 2, 1, 1])).toBe(0);
    expect(dtw([0, 0, 1, 1, 2, 2, 1, 1], [0, 1, 2, 1, 1])).toBe(0);
  });

  it('charges a flat line the full distance to the melody', () => {
    expect(dtw([0, 0, 0, 0], [3, -3, 3, -3])).toBe(3);
  });

  it('is bigger for a different shape', () => {
    expect(dtw([0, 3, -3, 0], [0, 0, 0, 0])).toBeGreaterThan(dtw([0, 3, -3, 0], [0, 2, -2, 0]));
  });
});

describe('accent score', () => {
  const otter = tone((t) => 220 * 2 ** (Math.sin(Math.PI * 2 * t) / 3), 1.2);

  it('rewards the same melody in a deeper voice, slower', () => {
    const you = tone((t) => 110 * 2 ** (Math.sin(Math.PI * 2 * t) / 3), 1.6);
    const r = accent(you, otter, SR);
    expect(r.accentScore).toBeGreaterThan(0.85);
    expect(r.pitch.you).toHaveLength(60);
    expect(r.pitch.ref).toHaveLength(60);
  });

  it('scores a flat delivery clearly lower', () => {
    const good = accent(tone((t) => 110 * 2 ** (Math.sin(Math.PI * 2 * t) / 3), 1.6), otter, SR);
    const flat = accent(tone(() => 120, 1.6), otter, SR);
    expect(good.accentScore - flat.accentScore).toBeGreaterThan(0.2);
  });

  it('returns null when nothing was voiced', () => {
    expect(accent(new Float32Array(SR), otter, SR)).toBeNull();
  });
});
