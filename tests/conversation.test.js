import { describe, it, expect } from 'vitest';
import { newChat, applyTurn, lineFrom, START_TRUST } from '../src/game/conversation.js';
import { OtterTurn, OTTER_TURN_SCHEMA, MOODS } from '../server/otter-prompt.js';
import { handleOtter } from '../server/otter.js';

describe('free-talk chat state', () => {
  it('starts at the starting trust with no history', () => {
    expect(newChat()).toEqual({ trust: START_TRUST, turn: 0, history: [], outcome: 'continue' });
  });

  it('applies a turn without mutating the old state', () => {
    const before = newChat();
    const after = applyTurn(before, 'aye', { trust: 45, turn: 1, outcome: 'continue', reply: 'No bad!' });
    expect(before.history).toEqual([]);
    expect(after).toMatchObject({ trust: 45, turn: 1 });
    expect(after.history).toEqual([
      { who: 'player', text: 'aye' },
      { who: 'otter', text: 'No bad!' },
    ]);
  });

  it('keeps only the last 20 history lines', () => {
    let chat = newChat();
    for (let i = 0; i < 15; i++) chat = applyTurn(chat, `p${i}`, { trust: 50, turn: i + 1, outcome: 'continue', reply: `o${i}` });
    expect(chat.history).toHaveLength(20);
    expect(chat.history.at(-1)).toEqual({ who: 'otter', text: 'o14' });
  });

  it('turns API audio into a playable data URL, or null for the browser voice', () => {
    expect(lineFrom({ reply: 'Aye', audio: 'QUJD' }).audio).toBe('data:audio/mpeg;base64,QUJD');
    expect(lineFrom({ reply: 'Aye', audio: null }).audio).toBeNull();
  });
});

describe('otter turn schema', () => {
  it('JSON schema and zod schema list the same fields', () => {
    expect(Object.keys(OTTER_TURN_SCHEMA.properties).sort()).toEqual(Object.keys(OtterTurn.shape).sort());
  });

  it('only uses moods the 3D otter can play', () => {
    expect(MOODS).toEqual(['good', 'ok', 'bad', 'suspicious']);
  });

  it('rejects a trust change outside -30..30', () => {
    const bad = { reply: 'x', mood: 'good', action: 'none', trust_delta: 90, sounded_local: true, hint: '' };
    expect(() => OtterTurn.parse(bad)).toThrow();
  });
});

describe('handleOtter input checks (no network)', () => {
  const env = { ANTHROPIC_API_KEY: 'k', ELEVENLABS_API_KEY: 'k' };
  it('rejects a too-long transcript', async () => {
    await expect(handleOtter({ said: 'a'.repeat(500) }, env)).rejects.toMatchObject({ status: 400 });
  });
  it('rejects trust out of range', async () => {
    await expect(handleOtter({ said: 'hi', trust: 400 }, env)).rejects.toMatchObject({ status: 400 });
  });
});
