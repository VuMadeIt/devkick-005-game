# devkick 005 game (working title)

Our entry for the **Devin Game Jam (devkick 005)**, Nov 14, 2026, University of Toronto, then the
**Chroma Awards, Game division**. Presentations are at **5pm**; presenting is how we enter.
The winner goes straight to the semifinals of its Chroma category.

**Idea:** to be decided by the team (see `docs/IDEA.md`).

## Run it
```bash
npm install
npm run dev      # opens on your laptop and on phones on the same Wi-Fi (use the Network URL)
npm run check    # tests + production build; must pass before every PR
```

## How we work (4 people + AI)
- `main` is always playable. Nobody pushes to `main` directly.
- One branch per task: `name/short-task` (e.g. `sam/bump-physics`). Open a PR when it works.
- CI runs tests and the build on every PR. Merge only when it's green and someone (or Devin Review) has looked.
- Small PRs, one working step each. That is also what the judges want to see.
- Lanes are in [TEAM.md](TEAM.md). Stay in your lane's files; ask in the group chat before editing someone else's.
- Every generated asset gets a line in [assets/manifest.json](assets/manifest.json) with its prompt.
- AI agents (Devin, Claude, Codex) follow [AGENTS.md](AGENTS.md).

## What the judges score
Read [docs/JUDGING.md](docs/JUDGING.md) once. Short version: it must run live, be fun in seconds, use AI
in the fun, feel good, sound good, and use Devin, Meshy and ElevenLabs visibly.

## Layout
| Path | What |
| --- | --- |
| `src/main.js` | Entry point (placeholder scene for now) |
| `src/game/` | Game code: loop, players, rules, UI |
| `tests/` | Vitest tests |
| `public/assets/` | Models (`.glb`), audio, images shipped with the game |
| `assets/manifest.json` | Every generated asset and its prompt (our tool-award proof) |
| `docs/` | Idea, judging notes, Devin briefs, Chroma checklist |

## Credits
Built with Devin. Models: Meshy. Voice, music and SFX: ElevenLabs.
