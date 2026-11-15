// Per-turn usage estimate for logs and docs/prd/cost-notes.md. Units only (tokens, TTS characters, STT
// seconds): prices change, so dollars are left to whoever reads the log with today's rate card.
// Tokens are estimated at ~4 characters per token (English prose + JSON); good to about +/-20%.
export const CHARS_PER_TOKEN = 4;
export const tokensOf = (chars) => Math.ceil(chars / CHARS_PER_TOKEN);

// A webm/opus recording from MediaRecorder runs at roughly 4 kB per second of speech.
export const sttSecondsOf = (base64Length) => Math.round(((base64Length * 3) / 4 / 4000) * 10) / 10;

// { system, user, schema, output, tts: string[], audioB64 } -> numbers safe to log (no text, no audio)
export function turnUsage({ system = '', user = '', schema = '', output = '', tts = [], audioB64 = 0, cachedSystem = false }) {
  const systemTokens = tokensOf(system.length + schema.length);
  return {
    inputTokens: systemTokens + tokensOf(user.length),
    cachedInputTokens: cachedSystem ? systemTokens : 0,
    outputTokens: tokensOf(output.length),
    ttsChars: tts.reduce((n, t) => n + (t ? t.length : 0), 0),
    sttSeconds: sttSecondsOf(audioB64),
  };
}
