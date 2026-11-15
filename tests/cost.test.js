import { describe, it, expect, vi } from 'vitest';
import { handleOtter, modelFor, MAX_TOKENS, HISTORY_LINES } from '../server/otter.js';
import { systemPromptFor } from '../server/otter-prompt.js';
import { createLru, cachedVoice } from '../server/ttsCache.js';
import { turnUsage, tokensOf } from '../server/cost.js';

const TURN = {
  reply: 'Aye, no bad. Whit brings ye tae the West End?',
  mood: 'ok',
  action: 'none',
  trust_delta: 3,
  sounded_local: true,
  hint: '',
  echo: '',
  suggestions: [],
};
const fakeClient = (turn = TURN) => {
  const create = vi.fn(async () => ({
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify(turn) }],
    usage: { input_tokens: 300, output_tokens: 60, cache_read_input_tokens: 1100 },
  }));
  return { create, client: { beta: { messages: { create } } } };
};
const env = { MAX_AI_TURNS_PER_DAY: '100000' };
const history = Array.from({ length: 14 }, (_, i) => ({ who: i % 2 ? 'otter' : 'player', text: `line ${i}` }));

describe('model routing', () => {
  it('defaults both tiers to the current model', () => {
    expect(modelFor({ said: 'aye' })).toBe(modelFor({ said: 'a long answer about the chippy on byres road', echo: 'x' }));
  });
  it('sends simple turns to OTTER_MODEL_FAST and the rest to OTTER_MODEL', () => {
    const e = { OTTER_MODEL: 'big', OTTER_MODEL_FAST: 'small' };
    expect(modelFor({ opening: true }, e)).toBe('small');
    expect(modelFor({ kind: 'quest', said: 'one two three four five six' }, e)).toBe('small');
    expect(modelFor({ said: 'aye pal' }, e)).toBe('small');
    expect(modelFor({ said: 'aye pal', echo: 'gaun yersel' }, e)).toBe('big');
    expect(modelFor({ said: 'ah go tae the chippy every friday night' }, e)).toBe('big');
  });
});

describe('the model request', () => {
  it('is small: 350 max tokens, last 8 lines, stable cached system prompt, short-reply ask', async () => {
    const { client, create } = fakeClient();
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const out = await handleOtter(
      { said: 'aye pal ah go tae the chippy on byres road', npc: 'otter', history, turn: 7 },
      { ...env, OTTER_MODEL: 'big', OTTER_MODEL_FAST: 'small' },
      { client },
    );
    const req = create.mock.calls[0][0];
    expect(req.model).toBe('big');
    expect(req.max_tokens).toBe(MAX_TOKENS);
    expect(MAX_TOKENS).toBeLessThanOrEqual(400);
    expect(req.system[0].text).toBe(systemPromptFor('otter'));
    expect(req.system[0].cache_control).toEqual({ type: 'ephemeral' });
    const user = req.messages[0].content;
    expect(user).toContain('line 13');
    expect(user).toContain(`line ${14 - HISTORY_LINES}`);
    expect(user).not.toContain(`line ${13 - HISTORY_LINES}`);
    expect(user).toMatch(/around 140 characters/);
    expect(out.reply).toBe(TURN.reply);
    // the usage log carries sizes only, never the text
    const line = log.mock.calls.find((c) => c[0] === '[otter] turn usage')[1];
    expect(JSON.parse(line)).toMatchObject({ npc: 'otter', model: 'big', inputTokens: 1400, outputTokens: 60 });
    expect(line).not.toContain('chippy');
    log.mockRestore();
  });

  it('skips the model and TTS when nothing was heard', async () => {
    const { client, create } = fakeClient();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const glasgow = await handleOtter({ said: '   ', npc: 'otter', trust: 50, turn: 3 }, { ...env, ELEVENLABS_API_KEY: 'k' }, { client });
    expect(create).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(glasgow).toMatchObject({ notHeard: true, trust: 50, turn: 3, audio: null });
    expect(glasgow.reply).toMatch(/couldnae hear/);
    const mumbai = await handleOtter({ said: '', npc: 'mor' }, env, { client });
    expect(mumbai.reply).toMatch(/couldn't hear/);
    fetchSpy.mockRestore();
  });
});

describe('TTS cache', () => {
  it('evicts the least recently used line', () => {
    const lru = createLru(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.get('a');
    lru.set('c', 3);
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe(1);
    expect(lru.size).toBe(2);
  });
  it('voices the same voice + text once', async () => {
    const voice = vi.fn(async (text, key, id) => `${id}:${text}`);
    const speak = cachedVoice(voice);
    expect(await speak('Haan, chalo.', 'k', 'v1')).toBe('v1:Haan, chalo.');
    await speak('Haan, chalo.', 'k', 'v1');
    await speak('Haan, chalo.', 'k', 'v2');
    expect(voice).toHaveBeenCalledTimes(2);
    expect(speak.stats).toEqual({ hits: 1, misses: 2 });
  });
});

describe('usage estimate', () => {
  it('counts tokens, TTS characters and STT seconds', () => {
    expect(tokensOf(400)).toBe(100);
    const u = turnUsage({ system: 'x'.repeat(800), user: 'y'.repeat(400), output: 'z'.repeat(200), tts: ['abc', null], audioB64: 16000, cachedSystem: true });
    expect(u).toEqual({ inputTokens: 300, cachedInputTokens: 200, outputTokens: 50, ttsChars: 3, sttSeconds: 3 });
  });
});
