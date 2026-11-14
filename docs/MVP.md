# MVP for 5pm: "Prove You're Scottish" (v2)

Nov 14, 2026, ~3:10pm. Replaces the London v1 (knife gang dropped; the team picked Scotland + animal local).

## Demo flow (~45 s per judge)
1. **Title** -> Play.
2. **World map.** Scotland lit and clickable; other places greyed "coming soon".
3. **The otter test** (this is the diagnostic placement test). A Scottish otter stops you:
   "Ye're no fae roon here, are ye? Prove it." Three lines, easy -> hard. For each:
   - the otter says it (ElevenLabs voice), text + meaning on screen;
   - you hold the talk button and say it back;
   - score: right words (speech-to-text) + how close your pitch/rhythm is to the otter's clip;
   - the otter reacts in voice, the **trust meter** moves, one **tip** appears ("roll the R").
4. **Result:** placed on a Duolingo-style path: Tourist -> Visitor -> Neighbour -> Local. Next lesson glows,
   the rest are locked.

## Lanes (3 people, each with their own Claude Code)
| Lane | Who | Owns | Delivers |
| --- | --- | --- | --- |
| 1. Game shell & scenes | Sadman (+ Claude here) | `src/main.js`, `src/game/`, `index.html`, `src/ui/` | Title, map, test scene, meter, result path, feel, deploy |
| 2. Voice scoring | teammate | `src/voice/` + `tests/voice*.test.js` | `listen()` per `src/voice/README.md`: mic, speech-to-text match, pitch/rhythm score |
| 3. Content & assets | teammate | `src/content/`, `public/assets/` | Otter voice lines, reactions, tips, SFX, music (ElevenLabs); otter + scene models (Meshy) |

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
