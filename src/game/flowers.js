// Free-talk scene: say anything. She moves on when she hears what the step needs, and warms up when you sound local.
// Keeps digits: speech-to-text writes "five quid" as "5 quid".
const clean = (s) => ` ${s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const has = (said, w) => said.includes(` ${w} `);

// shortcut: "local" = Scots words (and how Chrome mishears them); add accentScore once hint lines have otter clips.
export function localness(transcript, localWords) {
  const said = clean(transcript);
  const n = localWords.filter((w) => has(said, w)).length;
  return n ? Math.min(16, 8 * n) : -8;
}

const pick = (list, i) => list[i % list.length];

// state = { node, mood, turns } -> { state, aside, reply, ending: null | 'buy' | 'walk' }
export function turn(scene, state, transcript) {
  const node = scene.nodes[state.node];
  const said = clean(transcript);
  const intent = node.intents.find((it) => it.words.some((w) => has(said, w)));
  const local = localness(transcript, scene.localWords);
  const mood = Math.max(0, Math.min(100, state.mood + local + (intent ? intent.mood : -6)));
  const turns = state.turns + 1;
  const aside = pick(local > 0 ? scene.asides.warm : scene.asides.cold, state.turns);
  if (mood <= scene.leaveAt) return { state: { ...state, mood, turns }, aside, reply: scene.endings.walk, ending: 'walk' };
  if (!intent) return { state: { ...state, mood, turns }, aside: null, reply: pick(scene.asides.huh, state.turns), ending: null };
  if (intent.next === 'end') {
    const ending = mood >= scene.buyAt ? 'buy' : 'walk';
    return { state: { ...state, mood, turns }, aside, reply: scene.endings[ending], ending };
  }
  return { state: { node: intent.next, mood, turns }, aside, reply: intent.reply ?? scene.nodes[intent.next].say, ending: null };
}
