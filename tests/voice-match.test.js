import { describe, expect, it } from 'vitest';
import { normalise, similarity, wordScore } from '../src/voice/match.js';

describe('word matching', () => {
  it('ignores case and punctuation', () => {
    expect(normalise("It's a BRAW day!")).toBe("it's a braw day");
  });

  it('scores an exact line as 1', () => {
    expect(wordScore("it's a braw day", ["it's a braw day"])).toBe(1);
  });

  it('gives partial credit for a near miss', () => {
    const s = similarity("it's a bra day", "it's a braw day");
    expect(s).toBeGreaterThan(0.8);
    expect(s).toBeLessThan(1);
  });

  it('scores silence as 0', () => {
    expect(wordScore('', ['aye'])).toBe(0);
  });

  it('takes the best of several accepted lines', () => {
    expect(wordScore('eye', ['aye', 'eye'])).toBe(1);
  });
});
