// POST /api/otter: the player said something; the Devin Otter (Claude) answers and ElevenLabs voices it.
// Shared by the Vite dev middleware (vite.config.js) and the Vercel function (api/otter.js).
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { normalise, similarity } from '../src/voice/match.js';
import { OtterTurn, OTTER_TURN_SCHEMA, CHARACTERS, systemPromptFor } from './otter-prompt.js';

const MODEL = 'claude-opus-5-5';
// ElevenLabs voices (Voice Design, Glaswegian). VOICE_<ID> env vars override, e.g. VOICE_SENGA.
const VOICES = {
  otter: '9wOu10b6k3SOUgwDbKKv', // Devin Otter (Glaswegian)
  senga: 'U8lGdXfIYVx0Nas6m5XL', // Senga (Glasgow seagull)
  hamish: 'KnVW5icoKhKlU7DbTW8i', // Big Hamish (Glasgow bus driver)
};
const voiceFor = (npc, env) => env[`VOICE_${npc.toUpperCase()}`] || VOICES[npc] || VOICES.otter;
const TTS_MODEL = 'eleven_v3';
const MAX_TURNS = 8;
const START_TRUST = 30;

const STT_MODEL = 'scribe_v1';
const MAX_AUDIO_B64 = 2_000_000; // ~1.5 MB of audio, far more than 15 s of speech
const MAX_BODY_BYTES = MAX_AUDIO_B64 + 50_000;

const Request = z.object({
  said: z.string().max(400).default(''),
  // The recorded answer (base64) when the browser can't do speech recognition itself.
  audio: z.string().max(MAX_AUDIO_B64).optional(),
  audioType: z.string().max(60).regex(/^audio\/[\w.+-]+(;\s*codecs=[\w.+-]+)?$/).optional(),
  trust: z.number().min(0).max(100).default(START_TRUST),
  npc: z.enum(Object.keys(CHARACTERS)).default('otter'),
  // true: the player just walked up; the character greets them (not a turn, trust unchanged)
  opening: z.boolean().default(false),
  // How local the player's voice sounded (0-1, measured in the browser), and how well they matched
  // the last "say it back" phrase. null when it couldn't be measured.
  accent: z.number().min(0).max(1).nullable().default(null),
  echoAccent: z.number().min(0).max(1).nullable().default(null),
  echo: z.string().max(60).default(''),
  turn: z.number().int().min(0).max(50).default(0),
  history: z
    .array(z.object({ who: z.enum(['player', 'otter']), text: z.string().max(400) }))
    .max(30)
    .default([]),
});

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const stripTags = (text) => text.replace(/\[[^\]]*\]\s*/g, '').trim();
const clamp = (v) => Math.max(0, Math.min(100, v));

const pct = (v) => Math.round(v * 100);
function earsLine(accent, echoScore, echo) {
  const lines = [];
  if (echoScore !== null) lines.push(`They were saying back your phrase "${echo}". How well they matched it (words + accent): ${pct(echoScore)}/100.`);
  if (accent !== null) {
    const verdict = accent >= 0.65 ? 'sounds like a local' : accent >= 0.4 ? 'sounds half local' : 'sounds like a tourist';
    lines.push(`Their voice (pitch and rhythm vs a local voice): ${pct(accent)}/100, ${verdict}.`);
  }
  return lines.length ? lines.join('\n') : 'Their accent could not be measured this time.';
}

function transcript(history, said, trust, turn, ears) {
  const lines = history.map((h) => `${h.who === 'player' ? 'Player' : 'You'}: ${h.text}`);
  return [
    lines.length ? `Conversation so far:\n${lines.join('\n')}` : 'This is the start of the conversation.',
    `Current trust: ${trust}/100. Turn ${turn + 1} of ${MAX_TURNS}.`,
    ears.startsWith('OPENING') ? null : `The player just said (speech-to-text): "${said || '(nothing heard)'}"`,
    ears,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// The accent moves trust by itself, on top of what the character decides: up to +/-6 for a normal
// answer, up to +/-15 for a "say it back" attempt. Kept outside the model so it's fair and steady.
// "Say it back": share of the phrase's words the player said (fuzzy, so STT spellings count).
export function echoWords(said, echo) {
  const want = normalise(echo).split(' ').filter(Boolean);
  const got = normalise(said).split(' ').filter(Boolean);
  if (!want.length) return 0;
  const hit = want.filter((w) => got.some((g) => similarity(g, w) >= 0.67)).length;
  return hit / want.length;
}

export function echoScoreOf(said, echo, echoAccent) {
  if (!echo) return null;
  const words = echoWords(said, echo);
  return echoAccent === null ? words : 0.5 * words + 0.5 * echoAccent;
}

export function accentDelta(accent, echoScore) {
  if (echoScore !== null) return Math.round((echoScore - 0.5) * 30);
  if (accent !== null) return Math.round((accent - 0.5) * 12);
  return 0;
}

async function askOtter(client, npc, history, said, trust, turn, ears) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OTTER_TURN_SCHEMA } },
    system: [{ type: 'text', text: systemPromptFor(npc), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: transcript(history, said, trust, turn, ears) }],
  });
  if (response.stop_reason === 'refusal') {
    return { reply: "Och, let's no go there. Tell us whit ye're up tae the day?", mood: 'ok', action: 'none', trust_delta: 0, sounded_local: false, hint: '', echo: '' };
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new HttpError(502, `The otter gave no text (stop_reason ${response.stop_reason})`);
  return OtterTurn.parse(JSON.parse(text));
}

async function voice(line, key, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text: line, model_id: TTS_MODEL }),
  });
  if (!res.ok) throw new HttpError(502, `ElevenLabs ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return Buffer.from(await res.arrayBuffer()).toString('base64');
}

// ElevenLabs Scribe: the player's recorded answer -> text.
async function transcribe(base64, type, key) {
  const mime = type || 'audio/webm';
  const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('model_id', STT_MODEL);
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: mime }), `answer.${ext}`);
  const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': key },
    body: form,
  });
  if (!res.ok) throw new HttpError(502, `ElevenLabs STT ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  // Drop sound-event tags like "(rain)" or "[music]" so only words reach the otter.
  return String(data.text ?? '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function outcomeOf(trust, turn) {
  if (trust >= 100) return 'local';
  if (trust <= 0) return 'busted';
  if (turn + 1 >= MAX_TURNS) return 'out_of_time';
  return 'continue';
}

export async function handleOtter(body, env) {
  const parsed = Request.safeParse(body ?? {});
  if (!parsed.success) throw new HttpError(400, `Bad request: ${parsed.error.issues[0]?.message}`);
  const { trust, turn, history, audio: answerAudio, audioType, npc, accent, echoAccent, echo, opening } = parsed.data;
  let said = opening ? '' : parsed.data.said;
  if (answerAudio && !opening) {
    if (!env.ELEVENLABS_API_KEY) throw new HttpError(500, 'ELEVENLABS_API_KEY is needed to transcribe audio');
    said = await transcribe(answerAudio, audioType, env.ELEVENLABS_API_KEY);
  }

  // With no key, the SDK uses the local `ant auth login` profile (dev only; deploys need the key).
  const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : new Anthropic();
  const echoScore = said.trim() ? echoScoreOf(said, echo, echoAccent) : null;
  const ears = opening
    ? 'OPENING: the player has just walked up to you. Nobody has said anything yet. Greet them in character in one or two short spoken sentences and ask your first question. trust_delta must be 0 and echo must be empty.'
    : earsLine(accent, echoScore, echo);
  const turnOut = await askOtter(client, npc, history, said.trim(), trust, turn, ears);
  if (opening) {
    turnOut.trust_delta = 0;
    turnOut.echo = '';
  }
  const fromAccent = said.trim() ? accentDelta(accent, echoScore) : 0;
  const newTrust = clamp(trust + turnOut.trust_delta + fromAccent);
  const voiceId = voiceFor(npc, env);
  let audio = null;
  let echoAudio = null;
  if (!env.ELEVENLABS_API_KEY) {
    console.warn('[otter] ELEVENLABS_API_KEY not set: the client will use the browser voice');
  } else {
    try {
      // The reply and the "say it back" phrase are voiced at the same time; the phrase clip is what
      // the player's attempt gets compared with.
      [audio, echoAudio] = await Promise.all([
        voice(turnOut.reply, env.ELEVENLABS_API_KEY, voiceId),
        turnOut.echo ? voice(turnOut.echo, env.ELEVENLABS_API_KEY, voiceId).catch(() => null) : null,
      ]);
    } catch (err) {
      console.error('[otter] TTS failed, client will use the browser voice:', err.message);
    }
  }
  return {
    heard: said.trim(),
    reply: stripTags(turnOut.reply),
    mood: turnOut.mood,
    action: turnOut.action,
    hint: turnOut.hint,
    soundedLocal: turnOut.sounded_local,
    trust: newTrust,
    delta: newTrust - trust,
    accentDelta: fromAccent,
    echoScore,
    echo: turnOut.echo.trim(),
    echoAudio,
    turn: opening ? turn : turn + 1,
    maxTurns: MAX_TURNS,
    outcome: opening ? 'continue' : outcomeOf(newTrust, turn),
    audio,
  };
}

// Minimal Node (req, res) adapter used by both the dev server and Vercel.
export async function nodeHandler(req, res, env) {
  const send = (status, data) => {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'POST') return send(405, { error: 'POST only' });
  try {
    let body = req.body;
    if (body === undefined) {
      const chunks = [];
      let size = 0;
      for await (const c of req) {
        size += c.length;
        if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
        chunks.push(c);
      }
      const raw = Buffer.concat(chunks).toString('utf8');
      body = raw ? JSON.parse(raw) : {};
    }
    send(200, await handleOtter(body, env));
  } catch (err) {
    const status = err instanceof HttpError ? err.status : err instanceof SyntaxError ? 400 : 500;
    console.error('[otter]', status, err.message);
    send(status, { error: status >= 500 ? 'The otter is having a wee moment. Try again.' : err.message });
  }
}
