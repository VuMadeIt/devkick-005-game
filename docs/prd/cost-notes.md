# Cost notes: what one turn costs, before and after M3

Units only (tokens, TTS characters, STT seconds). Prices change; multiply by today's rate card.

## How this was measured

- `node scripts/cost-estimate.js` (or `npx vite-node scripts/cost-estimate.js`) builds a real request
  for a typical late-game free-talk turn with the actual Glasgow system prompt, the actual JSON schema
  and the actual `transcript()` the server sends: 7 exchanges so far (14 history lines of realistic
  length), a 4.5 s spoken answer, and a reply with a "say it back" phrase. No network calls.
- Tokens are estimated at ~4 characters per token (`server/cost.js`), about +/-20% for English + JSON.
  The schema is counted as input because structured output sends it with the request.
- STT seconds come from the recording size (~4 kB/s webm/opus). TTS characters are what ElevenLabs bills.
- In production, `/api/otter` now logs one `[otter] turn usage` line per turn with the same fields; when
  the model reports real `usage` the log uses that instead of the estimate. No text, audio or keys.
- Not measured live: no Anthropic calls were made for this work, so cache hit rates and real output
  lengths are estimates. Check the usage log after a day of real play.

## Per free-talk turn

| | Before | After | Change |
|---|---:|---:|---:|
| LLM input tokens (total) | 1,589 | 1,446 | -9% |
| of which cached system prompt + schema | 1,160 | 1,160 | same (already cached, still byte-stable) |
| LLM input tokens not cached | 429 | 286 | **-33%** (last 8 history lines, not all 14) |
| LLM output tokens (typical) | ~109 | ~105 | small; reply asked for ~140 chars, 220 hard cap |
| LLM output tokens (worst case) | 2,000 cap | 350 cap | **-82%** on runaway turns |
| TTS characters (reply + echo) | 141 | 124 | -12% per turn, plus LRU cache hits (0 on a cold instance) |
| STT seconds | 4.5 | 4.5 | same (can't shorten what the player says) |

## Per session (opening + up to 8 turns)

| | Before | After |
|---|---|---|
| Turns where nothing was heard | full LLM call + TTS | authored line, **0 LLM, 0 TTS** |
| Opening greeting, short answers, quest turns | main model | `OTTER_MODEL_FAST` if set (defaults to the main model, so no change until someone picks one) |
| Repeated lines (echo phrases, fallbacks) | voiced every time | voiced once per instance (`server/ttsCache.js`, 100 lines) |
| Scripted quest lines and placement lines | static mp3 (Glasgow) | static mp3 for Mumbai too once generated (see M6); browser voice until then |
| Mumbai NPC greetings | — | authored cast greeting + pre-voiceable mp3, **0 LLM, 0 TTS** (Glasgow keeps its fresh AI greetings) |
| Reply length | 1-2 sentences, failed the turn if over 220 chars | still 1-2 natural sentences (~140 chars); an over-long reply is cut at the last full sentence instead of failing |
| Past `MAX_AI_TURNS_PER_DAY` (default 2000) | unlimited spend | authored "come back tomorrow" line, no vendor calls |
| One IP hammering the API | unlimited | 20/min, 300/day on `/api/otter` and `/api/stt` |

The biggest real-world savings are the ones that remove whole calls: empty-input turns, scripted quests
with pre-generated audio instead of free talk, and the daily cap. Per-call trimming is a smaller, steady win.

## Quality guardrails

The aim is cheaper without sounding clipped. Replies are asked to sound like a real person talking
(contractions, one or two sentences, ~140 characters) rather than squeezed short, so a typical reply is
only ~12% shorter than before (124 vs 141 TTS characters). Most savings come from calls that no longer
happen and from input trimming, not from shorter lines.

Further cuts that were considered and **not** taken because they'd hurt quality: a cheaper TTS model
(e.g. a flash model) would weaken the accent, and dropping hints/suggestions from the reply would make
the game harder to play.

## Knobs

- `OTTER_MODEL` (default `claude-opus-5-5`, unchanged), `OTTER_MODEL_FAST` (default = `OTTER_MODEL`).
- `MAX_AI_TURNS_PER_DAY` (default 2000).
- `MAX_TOKENS` = 350, `HISTORY_LINES` = 8 in `server/otter.js`.

shortcut: limits and the TTS cache are in-memory per instance; move to a shared store (KV/Redis)
before real traffic.
