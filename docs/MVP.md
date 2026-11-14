# MVP for 5pm (v1, from the idea owner's doc)

Nov 14, 2026, ~2:55pm. Source: the team's Google Doc "devin".

## The idea owner's core (kept as-is)
- You're dropped into a place with its own accent and slang. MVP: **London**, modern British slang.
- Locals confront you; you must **convince them you're from the area** by speaking: the right words, the
  right slang, and the right accent (how you say it, not just what).
- Like *Teaching Your Little Sister How to Drive*: you just talk, and the characters answer and act based
  on what you said. Branching: what they say and do depends on you.
- Real, modern, everyday slang, unlike formal Duolingo. Later: learn slang in-app, then practise it here.
- Later: a little action (dodge on a button press), more cities.

## One thing to decide first: the knife gang
The doc's opening is masked men with knives. Chroma's rules disqualify graphic violence and have
"zero tolerance" for insensitive depictions; a masked, armed London gang is the stereotype most likely to
get flagged, and it's a weapon in a game about accents. The **mechanic doesn't need it**. Options that keep
the same tension:
| Option | The threat | Keeps |
| --- | --- | --- |
| **A. Animal locals** (recommended) | Same "you're not from round here, are you?" confrontation, but the locals are cartoon animals (a tough **otter** bouncer, a pigeon crew). Their weapon is suspicion, not knives | All the tension and slang; no human stereotype; the otter qualifies for the organizers' **$200 best otter 3D model** bonus |
| B. Undercover spy | You're a spy whose cover is "local"; guards' suspicion rises if your accent slips | Works for every future city |
| C. Keep the gang | As written | Highest disqualification risk |

## MVP scene (any option above)
**"Not From Round Here": London, one street, ~90 seconds.**
1. Intro (3D street, Meshy characters): the crew blocks your way. Leader (ElevenLabs London voice):
   "Oi, you lost, mate? Never seen you round 'ere."
2. **Three beats.** Each beat, the leader says a line; **2-3 possible replies show on screen** with what the
   slang means (e.g. "Nah fam, I'm from ends, innit"). You **say one out loud**.
3. The game hears which reply you said (speech-to-text) and how British it sounded (pitch and rhythm vs.
   the reference recording of that reply). Good = **suspicion meter** drops; bad = it rises.
4. They react in voice to what you said and how (branch per reply + per score band: convinced / unsure /
   "you're having a laugh").
5. Endings: **Accepted** (they let you through, "safe, bruv"), **Caught** (funny chase-off, retry), and a
   secret one if you nail every beat.
Free speech (say anything) comes later with an AI judge; shown replies keep it reliable today.

## How it listens
- **Which words:** the browser's built-in speech recognition (Chrome) for the demo; ElevenLabs Scribe later.
  Fuzzy-match the transcript to the 2-3 shown replies.
- **How you said it:** record the mic (Web Audio), pull pitch + loudness over time, compare with the
  ElevenLabs reference clip of that reply (DTW). Show both "melody lines" for a second after you speak.
- **Score:** words right (gate) x accent closeness -> suspicion change.

## Content to make (Content & audio lane)
- 3 beats x (1 leader line + 3 replies + 3 reactions x 2 score bands) = about 30 short clips, ElevenLabs
  voice design (one London voice for the leader, one for the player's reference "good accent").
- Slang glossary for the on-screen replies. Everyday and friendly; a Londoner on the team or in the room checks it.
- SFX: meter up/down, crowd "ooh", win sting. Music: tense street loop (ElevenLabs music).

## Art (Lead lane)
- Meshy: the crew leader (otter if option A) + 2 crew + a simple London street (terraced houses, red
  phone box, bus stop). One style reference image. Blender for scale/pivot fixes. Log every prompt.

## Build order (stop at any step and still have a demo)
| By | Step | Lane |
| --- | --- | --- |
| 3:20 | Mic -> speech-to-text -> match one of 3 replies, on a grey-box screen | Voice scoring |
| 3:35 | Beat/branch engine + suspicion meter + endings, with placeholder text | Lesson & game loop |
| 3:45 | All ~30 voice clips generated and dropped in | Content & audio |
| 3:55 | Pitch/rhythm compare + melody-line visual | Voice scoring |
| 4:10 | Meshy characters + street in the 3D scene | Lead |
| 4:25 | Feel: meter bounce, reaction anims, sounds, captions | All |
| 4:40 | Deploy public link, record backup video, 1 slide with numbers | Lead |
| 5:00 | Present: a judge tries beat 1 live, then a teammate plays the full scene | Lead |

## After today
Free speech with an AI judge (Modal), slang lessons before each scene, dodge action, more cities,
phone support, Chroma submission by Jan 7.
