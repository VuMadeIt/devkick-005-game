import { describe, expect, it } from 'vitest';
import { findScots, SCOTS_WORDS } from '../src/game/scotsWords.js';

describe('findScots', () => {
  it('finds Scots words the way speech-to-text spells them', () => {
    expect(findScots('Aye, how’s it gaun, pal?')).toEqual(['aye', 'pal', 'gaun']);
    expect(findScots("I'm away for my messages and an Iron Brew")).toEqual(['messages', 'irnbru']);
    expect(findScots('It is pure dead baltic, I cannae feel my wee hands')).toEqual(['wee', 'nae', 'baltic', 'pure']);
  });

  it('ignores plain English', () => {
    expect(findScots('Hello, I am a tourist visiting Edinburgh, I love haggis')).toEqual([]);
    expect(findScots('')).toEqual([]);
    expect(findScots(undefined)).toEqual([]);
  });

  it('does not match inside other words', () => {
    expect(findScots('tweet spalding ayes kennel')).toEqual([]);
  });

  it('has unique ids', () => {
    expect(new Set(SCOTS_WORDS.map((w) => w.id)).size).toBe(SCOTS_WORDS.length);
  });
});
