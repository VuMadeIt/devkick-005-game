// POST /api/otter: the player said something; the Devin Otter (Claude) answers and ElevenLabs voices it.
// Shared by the Vite dev middleware (vite.config.js) and the Vercel function (api/otter.js).
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { OtterTurn, OTTER_TURN_SCHEMA, SYSTEM_PROMPT } from './otter-prompt.js';

const MODEL = 'claude-opus-5-5';
const VOICE_ID = '9wOu10b6k3SOUgwDbKKv'; // Devin Otter (Glaswegian), ElevenLabs Voice Design
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

function transcript(history, said, trust, turn) {
  const lines = history.map((h) => `${h.who === 'player' ? 'Player' : 'Otter'}: ${h.text}`);
  return [
    lines.length ? `Conversation so far:\n${lines.join('\n')}` : 'This is the start of the conversation.',
    `Current trust: ${trust}/100. Turn ${turn + 1} of ${MAX_TURNS}.`,
    `The player just said (speech-to-text): "${said || '(nothing heard)'}"`,
  ].join('\n\n');
}

async function askOtter(client, history, said, trust, turn) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: OTTER_TURN_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: transcript(history, said, trust, turn) }],
  });
  if (response.stop_reason === 'refusal') {
    return { reply: "Och, let's no go there. Tell us whit ye're up tae the day?", mood: 'ok', action: 'none', trust_delta: 0, sounded_local: false, hint: '' };
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new HttpError(502, `The otter gave no text (stop_reason ${response.stop_reason})`);
  return OtterTurn.parse(JSON.parse(text));
}

async function voice(line, key) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
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
  const { trust, turn, history, audio: answerAudio, audioType } = parsed.data;
  let said = parsed.data.said;
  if (answerAudio) {
    if (!env.ELEVENLABS_API_KEY) throw new HttpError(500, 'ELEVENLABS_API_KEY is needed to transcribe audio');
    said = await transcribe(answerAudio, audioType, env.ELEVENLABS_API_KEY);
  }

  // With no key, the SDK uses the local `ant auth login` profile (dev only; deploys need the key).
  const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : new Anthropic();
  const turnOut = await askOtter(client, history, said.trim(), trust, turn);
  const newTrust = clamp(trust + turnOut.trust_delta);
  let audio = null;
  if (!env.ELEVENLABS_API_KEY) {
    console.warn('[otter] ELEVENLABS_API_KEY not set: the client will use the browser voice');
  } else {
    try {
      audio = await voice(turnOut.reply, env.ELEVENLABS_API_KEY);
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
    turn: turn + 1,
    maxTurns: MAX_TURNS,
    outcome: outcomeOf(newTrust, turn),
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
