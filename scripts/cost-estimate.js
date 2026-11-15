// Estimate the size of one free-talk turn, before and after the M3 cost cuts. No network calls.
// Run: node scripts/cost-estimate.js   (numbers feed docs/prd/cost-notes.md)
import { systemPromptFor, OTTER_TURN_SCHEMA } from '../server/otter-prompt.js';
import { transcript } from '../server/otter.js';
import { turnUsage } from '../server/cost.js';

// A typical late-game turn: 7 exchanges so far (14 history lines), each line about as long as real ones.
const reply = "Aye? Ye'd better no be windin' me up, pal. Whit's the best chippy roon here, then? Say it back: Ah'm gaun tae the toon.";
const player = "Aye pal, ah'm fae Glasgow, ah go tae the chippy on Byres Road every Friday.";
const history = Array.from({ length: 14 }, (_, i) => ({ who: i % 2 ? 'otter' : 'player', text: i % 2 ? reply : player }));
const ears = 'Their voice (pitch and rhythm vs a local voice): 62/100, sounds half local.';
const SHORT = 'Keep "reply" around 140 characters (hard limit 220).';
// What the model writes back: reply + mood/action + hint + two suggestions + echo, as JSON.
const answer = (r) =>
  JSON.stringify({ reply: r, mood: 'ok', action: 'tilt_head', trust_delta: 4, sounded_local: true, hint: 'Try "how\'s it gaun" for hello.', echo: "Ah'm gaun tae the toon", suggestions: [{ say: 'Aye, the wan oan Byres Road', means: 'Yes, the one on Byres Road' }, { say: 'Ah cannae mind the name', means: "I can't remember the name" }] });
const shortReply = "Aye? Ye'd better no be windin' me up, pal. Best chippy roon here? Say it back: Ah'm gaun tae the toon.";
const system = systemPromptFor('otter');
const schema = JSON.stringify(OTTER_TURN_SCHEMA);
const audioB64 = Math.round(((4.5 * 4000) * 4) / 3); // a 4.5 s answer

const before = turnUsage({ system, schema, cachedSystem: true, user: transcript(history, player, 55, 7, ears), output: answer(reply), tts: [reply, "Ah'm gaun tae the toon"], audioB64 });
const after = turnUsage({ system, schema, cachedSystem: true, user: `${transcript(history.slice(-8), player, 55, 7, ears)}\n\n${SHORT}`, output: answer(shortReply), tts: [shortReply, "Ah'm gaun tae the toon"], audioB64 });
console.table({ before, after });
