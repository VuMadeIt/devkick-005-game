import { describe, expect, it } from 'vitest';
import scene from '../src/content/flowers.json';
import { turn } from '../src/game/flowers.js';

function play(lines) {
  let state = { node: scene.start, mood: scene.mood, turns: 0 };
  let r;
  for (const line of lines) {
    r = turn(scene, state, line);
    state = r.state;
    if (r.ending) break;
  }
  return r;
}

describe('flower stall', () => {
  it('sells when you sound local', () => {
    const r = play(["awright hen how's it going", 'fancy some flowers pal', 'five quid hen', 'och they are fresh the day']);
    expect(r.ending).toBe('buy');
  });

  it('she walks off from a polite tourist', () => {
    const r = play(['hello how are you', 'would you like to buy some flowers', 'five pounds please', 'they are very fresh']);
    expect(r.ending).toBe('walk');
  });

  it('understands how Chrome mishears a local (real transcripts)', () => {
    const r = play(["a right hand how's it going", "fancy sunflowers now they're pure lovely", '5 Quinn a wee Market', "but they're fresh today go on"]);
    expect(r.ending).toBe('buy');
  });

  it('replies to what you actually said', () => {
    const s = { node: 'offer', mood: 40, turns: 0 };
    expect(turn(scene, s, 'some lovely thistles hen').reply).toMatch(/Thistles/);
    expect(turn(scene, s, "I've got Heather from the campsie Fells").reply).toMatch(/Heather/);
    // Chrome heard "hen" as "10": that alone mustn't read as asking ten quid
    expect(turn(scene, { ...s, node: 'price' }, 'just for quit for you 10').reply).toMatch(/no bad/);
  });

  it('she leaves if you talk nonsense', () => {
    const r = play(['banana', 'the weather in london', 'spaceship']);
    expect(r.ending).toBe('walk');
  });

  it('a miss keeps you on the same step', () => {
    const r = turn(scene, { node: 'greet', mood: 40, turns: 0 }, 'aye banana');
    expect(r.state.node).toBe('greet');
    expect(r.ending).toBeNull();
  });
});
