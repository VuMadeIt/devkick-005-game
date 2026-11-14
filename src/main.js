// Lane 1: game shell. Title -> world map -> otter placement test -> result path.
import './ui/styles.css';
import scotland from './content/scotland.json';
import { createStage } from './game/otterScene.js';
import { say, sfx, setMuted, isMuted, unlockAudio } from './game/audio.js';
import { band, clampTrust, placement, trustDelta } from './game/placement.js';
import { listen, isSupported } from './voice/index.js';

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
  await say(line);
  if (mood === 'talk') stage.react('idle');
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
  popIn($('prompt'));
}

async function startTest() {
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

// ---- talking (hold Space or hold the button)
let session = null;
function beginTalk() {
  if (busy || session || $('talk').disabled) return;
  const item = place.test[index];
  sfx('start');
  $('talk').classList.add('recording');
  $('talk-label').textContent = 'Listening...';
  $('heard').textContent = '';
  stage.react('idle');
  session = listen({ expected: item.accepted.concat(item.line), referenceUrl: item.audio });
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
  await judge(r);
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
  sfx('level');
  stage.react(p.index >= 2 ? 'good' : 'ok');
}

// ---- wiring
$('play').addEventListener('click', () => {
  unlockAudio();
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
$('again').addEventListener('click', () => {
  sfx('tap');
  startTest();
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
