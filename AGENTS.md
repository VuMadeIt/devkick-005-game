# Instructions for AI agents (Devin, Claude, Codex)

You are building a browser game for a one-day jam. Demo at 5pm. Working beats clever.

## Stack (don't change it)
- Three.js + Vite, plain JavaScript (ES modules). Vitest for tests.
- Static build (`npm run build` -> `dist/`), deployed to a public host. Relative asset paths only.
- No Unity, no Roblox, no frameworks added without the team agreeing.

## Every task
1. Read `docs/IDEA.md` and the files your task names. Don't read the whole repo.
2. Work on a branch, one working step per PR. Describe what changed and how you checked it.
3. Done means: `npm run check` passes, the game runs in the browser with **no console errors**, and the
   feature works when you actually play it (tests alone are not proof).
4. Anything that touches controls or UI must work at phone size (about 844x390 landscape) with touch
   buttons at least 44 px, nothing under the player's thumbs.
5. Keep `main` playable. If you break the build, fix it before anything else.

## Assets
- Log every generated asset in `assets/manifest.json` (tool, exact prompt, file, who, date).
- Ask a human before spending Meshy or ElevenLabs credits.
- Models: `.glb`, under ~2 MB each, scaled and with the pivot at the feet.
- Only original or properly licensed content. No other games' characters, brands, logos, real people's
  voices or faces. No copyrighted music.

## Secrets
- Never commit keys. Never put an API key in `src/` (it ships to every player). Keys go in a backend or
  local scripts, read from `.env` (see `.env.example`).

## Game feel defaults
- Gameplay runs on the fixed 120 Hz loop in `src/game/loop.js`.
- Every player action gets instant feedback: sound, a small squash or flash, and a visible result.
- Big moments (KO, win) get a short freeze (~60-100 ms), a camera nudge and a sound that lands.
- In-game text in English. Captions for any voice line. A mute/volume control.

## Credits
Keep the "Built with Devin" credit on screen.
