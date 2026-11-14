// Lane 1: game shell. Title -> world map -> otter placement test -> result path.
import './ui/styles.css';
import scotland from './content/scotland.json';
import { createStage } from './game/otterScene.js';
import { say, sfx, setMuted, isMuted, unlockAudio, startBed, setBed } from './game/audio.js';
import { band, clampTrust, placement, trustDelta } from './game/placement.js';
import { listen, isSupported } from './voice/index.js';
import flowers from './content/flowers.json';
import { turn } from './game/flowers.js';

const $ = (id) => document.getElementById(id);
const stage = createStage($('stage'));
const place = scotland;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}
function popIn(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

// ---- bubble / speech
async function otterSays(line, mood = 'talk') {
  const bubble = $('bubble');
  $('bubble-text').textContent = line.text;
  bubble.classList.add('show');
  stage.react(mood === 'talk' ? 'talk' : mood);
  setBed('under');
  await say(line);
  setBed('full');
  if (mood === 'talk') stage.react('idle');
}

// ---- melody lines: otter (amber) vs. you (blue), semitones around each speaker's median
function drawMelody(pitch) {
  const svg = $('melody');
  if (!pitch?.you?.length || !pitch?.ref?.length) {
    svg.classList.remove('show');
    return;
  }
  const pts = (arr) =>
    arr
      .map((v, i) => {
        const x = (i / (arr.length - 1)) * 240;
        const y = 24 - Math.max(-12, Math.min(12, Number.isFinite(v) ? v : 0)) * 1.8;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  $('mel-ref').setAttribute('points', pts(pitch.ref));
  $('mel-you').setAttribute('points', pts(pitch.you));
  svg.classList.add('show');
}

// ---- state
let index = 0;
let trust = 30;
let scores = [];
let busy = false;

function setTrust(v) {
  trust = clampTrust(v);
  const fill = $('trust-fill');
  fill.style.width = `${trust}%`;
  fill.style.background = trust >= 65 ? 'var(--green)' : trust >= 35 ? 'var(--amber)' : 'var(--red)';
}

function showItem(i) {
  const item = place.test[i];
  $('step').textContent = `${i + 1} / ${place.test.length}`;
  $('level').textContent = item.level[0].toUpperCase() + item.level.slice(1);
  $('line').textContent = item.line;
  $('meaning').textContent = `Means: ${item.meaning}`;
  $('heard').textContent = '';
  $('tip').textContent = '';
  $('melody').classList.remove('show');
  popIn($('prompt'));
}

async function startTest() {
  mode = 'test';
  $('speaker').textContent = place.character.name;
  $('result-sub').textContent = 'The Devin Otter places you as a';
  index = 0;
  scores = [];
  setTrust(30);
  show('test');
  busy = true;
  setTalk(false, 'Listen...');
  showItem(0);
  await otterSays(place.character.intro, 'suspicious');
  await new Promise((r) => setTimeout(r, 250));
  await presentItem();
}

async function presentItem() {
  const item = place.test[index];
  busy = true;
  setTalk(false, 'Listen...');
  await otterSays({ text: `Say: "${item.line}"`, audio: item.audio ? item.audio : null });
  busy = false;
  setTalk(true, 'Hold to talk');
}

function setTalk(enabled, label) {
  const b = $('talk');
  b.disabled = !enabled;
  $('talk-label').textContent = label;
}

// ---- free talk: sell Morag some flowers (src/content/flowers.json)
let mode = 'test';
let talkState = null;

function showStep(stuck = false) {
  const node = flowers.nodes[talkState.node];
  $('step').textContent = 'Free talk';
  $('level').textContent = flowers.name;
  $('line').textContent = node.facts.join(' ');
  $('meaning').textContent = flowers.intro;
  $('tip').textContent = stuck ? `Tip: try "${node.hint}"` : '';
  $('melody').classList.remove('show');
  popIn($('prompt'));
}

async function startFlowers() {
  mode = 'flowers';
  talkState = { node: flowers.start, mood: flowers.mood, turns: 0 };
  $('speaker').textContent = flowers.character.name;
  setTrust(talkState.mood);
  show('test');
  showStep();
  $('heard').textContent = '';
  busy = true;
  setTalk(false, 'Listen...');
  await otterSays({ text: flowers.nodes[flowers.start].say }, 'suspicious');
  busy = false;
  setTalk(true, 'Hold to talk');
}

async function talkTurn(r) {
  if (!r.transcript) {
    $('heard').textContent = r.error === 'not-allowed' ? 'Allow the microphone to play.' : "Didn't catch that. Hold the button while you speak.";
    busy = false;
    setTalk(true, 'Try again');
    return;
  }
  const before = talkState.mood;
  const nodeBefore = talkState.node;
  const t = turn(flowers, talkState, r.transcript);
  talkState = t.state;
  $('heard').textContent = `Heard: "${r.transcript}"`;
  setTrust(t.state.mood);
  const b = t.state.mood > before ? 'good' : t.state.mood < before ? 'bad' : 'ok';
  sfx(b);
  if (t.aside) await otterSays({ text: t.aside }, b);
  await otterSays({ text: t.reply }, t.ending === 'buy' ? 'good' : t.ending === 'walk' ? 'bad' : 'talk');
  if (!t.ending) {
    showStep(t.state.node === nodeBefore);
    busy = false;
    setTalk(true, 'Hold to talk');
    return;
  }
  $('result-sub').textContent = flowers.character.name;
  $('result-level').textContent = t.ending === 'buy' ? 'Bought your flowers!' : 'Walked off';
  $('result-score').textContent = t.ending === 'buy' ? 'She took ye for a local.' : 'Try sounding more local: aye, hen, wee, quid.';
  $('path').innerHTML = '';
  $('bubble').classList.remove('show');
  show('result');
  stage.react(t.ending === 'buy' ? 'good' : 'ok');
  sfx(t.ending === 'buy' ? 'level' : 'bad');
}

// ---- talking (hold Space or hold the button)
let session = null;
function beginTalk() {
  if (busy || session || $('talk').disabled) return;
  sfx('start');
  setBed('off');
  $('talk').classList.add('recording');
  $('talk-label').textContent = 'Listening...';
  $('heard').textContent = '';
  stage.react('idle');
  const item = place.test[index];
  session = mode === 'flowers' ? listen() : listen({ expected: item.accepted.concat(item.line), referenceUrl: item.audio });
}

async function endTalk() {
  if (!session) return;
  const s = session;
  session = null;
  $('talk').classList.remove('recording');
  busy = true;
  setTalk(false, 'Hmm...');
  s.stop();
  const r = await s.result;
  setBed('full');
  await (mode === 'flowers' ? talkTurn(r) : judge(r));
}

async function judge(r) {
  const item = place.test[index];
  if (r.error === 'not-allowed') {
    $('heard').textContent = 'Allow the microphone to play.';
    busy = false;
    setTalk(true, 'Hold to talk');
    return;
  }
  if (!r.transcript) {
    $('heard').textContent = "Didn't catch that. Hold the button while you speak.";
    sfx('ok');
    busy = false;
    setTalk(true, 'Try again');
    return;
  }
  const score = r.score;
  scores.push(score);
  const b = band(score);
  $('heard').textContent = `Heard: "${r.transcript}"`;
  drawMelody(r.pitch);
  if (b !== 'good') $('tip').textContent = `Tip: ${item.tip}`;
  sfx(b);
  setTrust(trust + trustDelta(score));
  await otterSays(item.reactions[b], b);
  await new Promise((res) => setTimeout(res, 700));
  index += 1;
  if (index < place.test.length) {
    showItem(index);
    await presentItem();
  } else {
    await finish();
  }
}

async function finish() {
  const p = placement(scores, place.path);
  await otterSays(place.character.outro, 'talk');
  $('result-level').textContent = p.level.name;
  $('result-score').textContent = `Accent score ${Math.round(p.average * 100)} / 100`;
  const path = $('path');
  path.innerHTML = '';
  place.path.forEach((lvl, i) => {
    const li = document.createElement('li');
    li.textContent = lvl.name;
    li.className = i < p.index ? 'done' : i === p.index ? 'here' : 'locked';
    path.appendChild(li);
  });
  $('bubble').classList.remove('show');
  show('result');
  stage.react(p.index >= 2 ? 'good' : 'ok');
  // The otter cheers over a victory sting sized to the level (lane 3); synth sting if it's missing.
  if (p.level.celebration) {
    setBed('off');
    await say(p.level.celebration);
    setBed('full');
  } else {
    sfx('level');
  }
}

// ---- wiring
$('play').addEventListener('click', () => {
  unlockAudio();
  startBed();
  sfx('tap');
  show('map');
});
document.querySelector('.pin.live').addEventListener('click', () => {
  sfx('tap');
  if (!isSupported()) {
    alert('Please open this in Google Chrome so the game can hear you.');
    return;
  }
  startTest();
});
$('pin-flowers').addEventListener('click', () => {
  sfx('tap');
  if (!isSupported()) {
    alert('Please open this in Google Chrome so the game can hear you.');
    return;
  }
  startFlowers();
});
$('again').addEventListener('click', () => {
  sfx('tap');
  if (mode === 'flowers') startFlowers();
  else startTest();
});
$('to-map').addEventListener('click', () => {
  sfx('tap');
  $('bubble').classList.remove('show');
  show('map');
});
$('mute').addEventListener('click', () => {
  setMuted(!isMuted());
  $('mute').textContent = isMuted() ? 'Sound off' : 'Sound on';
});

const talk = $('talk');
talk.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  talk.setPointerCapture(e.pointerId);
  beginTalk();
});
talk.addEventListener('pointerup', endTalk);
talk.addEventListener('pointercancel', endTalk);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && $('test').classList.contains('active')) {
    e.preventDefault();
    beginTalk();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') endTalk();
});
