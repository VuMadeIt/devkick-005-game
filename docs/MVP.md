# MVP for 5pm: "Prove You're Scottish" (v3)

Nov 14, 2026, ~3:10pm. v3 (3:30pm): the local is **the Devin otter** (Devin's mascot, built in Meshy) speaking with a **real Glaswegian accent** (ElevenLabs); the look is **low-poly streets of Glasgow**. Tools for every step: [TOOLS.md](TOOLS.md).

## Demo flow (~45 s per judge)
1. **Title** -> Play.
2. **World map.** Glasgow, Scotland lit and clickable; other places greyed "coming soon".
3. **The otter test** (the diagnostic placement test), on a low-poly Glasgow street. The Devin otter stops you:
   "Ye're no fae roon here, are ye? Prove it." Three lines, easy -> hard. For each:
   - the otter says it (ElevenLabs voice), text + meaning on screen;
   - you hold the talk button and say it back;
   - score: right words (speech-to-text) + how close your pitch/rhythm is to the otter's clip;
   - the otter reacts in voice, the **trust meter** moves, one **tip** appears ("roll the R").
4. **Result:** placed on a Duolingo-style path: Tourist -> Visitor -> Neighbour -> Local. Next lesson glows,
   the rest are locked.

## Lanes (3 people)
| Lane | Who | Tools | Owns |
| --- | --- | --- | --- |
| 1. Game shell + art (otter, Glasgow map) + deploy + demo | Sadman | Claude Code, Meshy, Rosebud, ChatGPT/Gemini, Blender, Vercel, OBS | `src/main.js`, `src/game/`, `src/ui/`, `index.html`, `public/assets/models/`, `public/assets/images/` |
| 2. Voice scoring + backend | Vu | Devin, Claude Code/Cursor, ElevenLabs Scribe, Modal | `src/voice/`, `backend/`, `tests/voice*.test.js` |
| 3. Voice, sound, music | Paul | ElevenLabs (Voice Design, TTS, SFX, Music), Modal batch script, Cursor/Claude Code | `src/content/`, `public/assets/audio/`, `scripts/` |

The **contracts** below let all three work at once. Lane 1 ships with placeholders and swaps in real voice
and assets as they land.

## Contracts
- **Content:** `src/content/scotland.json` (schema in `src/content/README.md`). Lane 3 fills real lines,
  audio file names and tips; lane 1 reads it.
- **Voice:** `src/voice/index.js` exports `listen({ expected, referenceUrl })` -> `{ transcript, wordScore,
  accentScore, score }` (all 0-1). A working fallback is already in place (browser speech recognition, no
  accent score); lane 2 replaces the inside without changing the shape.
- **Assets:** drop files in `public/assets/audio/` and `public/assets/models/`; log prompts in `assets/manifest.json`.

## Timeline
| By | Goal |
| --- | --- |
| 3:40 | Shell playable end to end with placeholder voice (browser TTS) and grey boxes |
| 4:00 | Real otter lines + reactions in; real `listen()` with accent score |
| 4:15 | Otter model + scene in; feature freeze |
| 4:35 | Deployed public link, backup video, one slide with numbers |
| 5:00 | Present |
