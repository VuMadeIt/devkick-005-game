# Every tool we have, and how we use it to the full

Team: Sadman (Claude Code), Vu (Claude Code or Cursor), Paul (Cursor or Claude Code). Everyone has the
hackathon freebies: Devin, ElevenLabs, Meshy, Rosebud, Modal. Plus Sadman's own kit (ChatGPT/Gemini images,
Blender, OBS, Vercel, his feel and UI skills).

## The look in one line
**Low-poly streets of Glasgow** (red and blond sandstone tenements, wet cobbles, lamp posts, a chippy, a
statue with a traffic cone on its head, grey drizzly sky) and **the Devin otter** (Devin's mascot) as the
local who tests your accent, speaking with a **real Glaswegian accent** from ElevenLabs.

> Mascot note: the Devin otter is Cognition's character. Great for today (they're the sponsor). For the
> Chroma entry we need their OK in writing: ask Yohann at the jam and screenshot the answer.

## Sponsor tools (everyone has them)
| Tool | Full use in this game | Owner |
| --- | --- | --- |
| **Devin** | 1) Lane 2's pitch + DTW accent scoring as Devin sessions, one PR each. 2) **Devin Review on every PR** from all three of us. 3) A Devin session to set up the Vercel/Cloudflare deploy on merge. 4) Devin security scan before we publish. 5) Count sessions/PRs/reviews for the demo slide. | Vu (scoring), everyone (reviews) |
| **ElevenLabs Voice Design** | The otter's voice: a warm, cheeky **Glaswegian** voice designed from a prompt (3 takes, pick the best). No real person's voice. | Paul |
| **ElevenLabs TTS** | All 14 otter lines (intro, outro, 3 test lines = the accent references, 9 reactions). Use the "eleven_v3" style tags for emotion: [suspicious], [laughs], [impressed]. | Paul |
| **ElevenLabs Sound Effects** | Tap, start-talking blip, good/ok/bad, level-up, rain on cobbles, distant bus, seagulls (Glasgow ambience). | Paul |
| **ElevenLabs Music** | 30 s loopable track: modern Glasgow street feel with a light fiddle hook. Plus a 3 s win sting. | Paul |
| **ElevenLabs Speech-to-Text (Scribe)** | Hears Scots words far better than Chrome's recognition ("dinnae", "aboot"). Through Modal so the key stays secret; Chrome recognition stays as the fallback. | Vu |
| **ElevenLabs Agents** (stretch) | "Free talk" mode after the test: chat with the otter live, in accent. Signed URL from Modal. | Vu, after 4:15 |
| **Meshy** | The Devin otter (image-to-3D from the mockup, **low-poly** setting, auto-rig + idle/talk/happy/annoyed animations). Glasgow street kit: tenement block, chippy front, lamp post, bins, bus stop, cone-head statue, cobbles. Also enters the **$200 best otter** prize; Meshy features games on its site. | Sadman |
| **Rosebud AI** | Overcast Glasgow **skybox**, and a fast throwaway blockout of the street to test the camera before the Meshy kit lands. | Sadman |
| **Modal** | Tiny backend: `/stt` (ElevenLabs Scribe), `/agent-url` (ElevenLabs Agents signed URL), later `/coach`. Also a batch script that generates every voice line from `scotland.json` in one run. | Vu (backend), Paul (batch script) |

## Our own tools
| Tool | Full use | Owner |
| --- | --- | --- |
| **Claude Code** (x2 seats) | Sadman's seat: lane 1 game code, feel pass, wiring assets, deploy, demo prep; runs browser checks at phone size. Second seat: whichever lane it's on, with `CLAUDE.md` loaded. Both use subagents for parallel side jobs. | Sadman + teammate |
| **Cursor** | The Cursor teammate's lane; `.cursor/rules/project.mdc` loads the same rules as `CLAUDE.md`. Great for fast edits to `scotland.json` and small UI tweaks. | Cursor teammate |
| **ChatGPT images (gpt-6.1-sol)** + **Gemini** | 1) One mockup of the low-poly Glasgow street + otter, the look everyone matches. 2) A clean front-view otter picture to feed Meshy image-to-3D. 3) The title-screen art and Chroma thumbnail. | Sadman |
| **Blender** | Fix Meshy models: scale, pivot at the feet, decimate to low poly, flat colours, assemble the street kit into one `glasgow.glb`. | Sadman |
| **Feel skills** (nintendo-feel, reactive-feel) | Press feedback, meter pops, otter reactions, the result reveal. | Sadman (lane 1) |
| **GitHub** | Lane issues are the message board between our agents; PRs + CI; Devin Review. | Everyone |
| **Vercel** | Public link for the demo and Chroma. | Sadman |
| **OBS + ffmpeg** | Backup demo video now; Chroma gameplay video and the Behind-the-Scenes entry later. | Sadman |

## Lanes after the change (Sadman builds the otter and the map)
| Lane | Owner | Owns |
| --- | --- | --- |
| 1. Game shell, art (otter + Glasgow map), deploy, demo | **Sadman** (Claude Code builds the code) | `src/main.js`, `src/game/`, `src/ui/`, `index.html`, `public/assets/models/`, `public/assets/images/` |
| 2. Voice scoring + backend | **Vu** | `src/voice/`, `backend/` (Modal), `tests/voice*.test.js` |
| 3. Voice, sound, music | **Paul** | `src/content/`, `public/assets/audio/`, `scripts/` (batch generation) |
Everyone logs generated assets in `assets/manifest.json`.
