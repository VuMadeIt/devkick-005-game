# For every teammate's Claude Code (and Devin, Codex)

Read this, then `AGENTS.md` and `docs/MVP.md`. Demo at **5pm today**. Working beats clever.

## Which lane am I?
Ask your human which lane they own (see `docs/MVP.md`): 1 shell & scenes, 2 voice scoring, 3 content &
assets. **Edit only your lane's files.** Shared contracts (`src/content/scotland.json` shape,
`src/voice/index.js` `listen()` shape) don't change without a message on the lane issue.

## How the sessions talk to each other (GitHub is the channel)
Claude Code sessions on different laptops can't message each other directly. Use the repo:
- Each lane has a pinned GitHub issue: `gh issue list -R sadmanc/devkick-005-game`.
- **Before starting** and **every ~20 minutes**: `gh issue view <your lane issue> --comments` and read
  the other lanes' issues for asks aimed at you.
- To ask another lane for something: `gh issue comment <their issue> --body "..."` (short, concrete, with a time).
- When you finish a piece: comment on your own issue with what landed and the PR link.

## Git, so nobody overwrites anyone
- `git pull --rebase` before you start and before every push.
- Branch per task: `<name>/<task>`, PR to `main`, merge when `npm run check` passes. Small PRs, often.
- If `main` moved under you, rebase; never force-push `main`.

## Run / check
`npm install`, `npm run dev` (Chrome; the mic needs localhost or https), `npm run check` before every PR.
