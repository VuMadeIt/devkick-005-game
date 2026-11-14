# Content (lane 3 owns this folder)

One JSON file per place. `scotland.json` is the MVP.

- `character`: name, model path (under `public/`), intro/outro line with audio.
- `test[]`: the placement test, easy -> hard. Each item:
  - `line` (what the player says), `meaning` (plain English), `tip` (one thing to fix),
  - `accepted`: lowercase ways speech-to-text may hear it (it will hear Scots words as English ones),
  - `audio`: the otter saying the line; this is also the **reference** the accent score compares against,
  - `reactions.good|ok|bad`: what the otter says back.
- `path[]`: placement levels with the minimum average score (0-1).

Audio paths are relative to `public/`. Until a file exists the game falls back to the browser's
built-in voice, so missing audio never breaks the demo. Keep lines short (under 3 s), everyday and kind.
Log every ElevenLabs / Meshy prompt in `assets/manifest.json`.
