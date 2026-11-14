// Lane 1: game shell. Title -> world map -> otter placement test -> result path.
import './ui/styles.css';
import scotland from './content/scotland.json';
import { createStage } from './game/otterScene.js';
import { say, sfx, setMuted, isMuted, unlockAudio, startBed, setBed } from './game/audio.js';
import { band, clampTrust, placement, trustDelta } from './game/placement.js';
import { listen, isSupported } from './voice/index.js';
import { createLive } from './game/liveVoice.js';
import { createLessons } from './ui/lessons.js';

const $ = (id) => document.getElementById(id);
const stage = createStage($('stage'));
const place = scotland;
const live = createLive($('live'), $('ring'), $('match'));
let lastLean = 0;
live.onVoice((voiced) => {
  $('talk').classList.toggle('voiced', voiced);
  // the otter leans in and tilts its head while you're making sound
  const now = performance.now();
  if (voiced && now - lastLean > 1400) {
    lastLean = now;
    stage.react('ok');
  }
});

function floatPop(text, kind = '', delay = 0) {
  setTimeout(() => {
    const el = document.createElement('span');
    el.textContent = text;
    el.className = kind;
    $('pops').appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }, delay);
}

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  // 2D screens (title, map, result, lessons) cover the 3D street; the otter test shows it
  document.body.classList.toggle('flat', $(id).classList.contains('flat'));
}

// Placement: a good accent test skips you 50 lessons ahead, otherwise you start at lesson 1.
const SKIP_AT = 0.6;
const SKIP_LESSONS = 50;
const lessons = createLessons({ root: $('learn'), onTap: ({ state }) => sfx(state === 'locked' ? 'ok' : 'tap') });
let placedAt = 0;

// score counts up (time grows with the number, 0.35..1.2 s), then the card settles
function countUp(el, to) {
  const dur = Math.min(1200, 350 + to * 9);
  const t0 = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(tick);
    else popIn(el.parentElement);
  };
  requestAnimationFrame(tick);
}

function showResult(average, level) {
  const well = average >= SKIP_AT;
  placedAt = well ? SKIP_LESSONS : 0;
  $('result-level').textContent = level.name;
  $('result-note').textContent = well
    ? `Ye sound like ye belong here. Skipping you ahead ${SKIP_LESSONS} lessons to lesson ${SKIP_LESSONS + 1}.`
    : 'Everyone starts somewhere. You begin at lesson 1.';
  $('result-score').textContent = '0';
  show('result');
  popIn($('result').querySelector('.popup'));
  countUp($('result-score'), Math.round(average * 100));
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
let streak = 0;
let attempt = 0;

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
  attempt = 0;
  live.show(item.audio);
  popIn($('prompt'));
}

async function startTest() {
  index = 0;
  scores = [];
  streak = 0;
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

async function replayLine() {
  if (busy || session) return;
  const item = place.test[index];
  sfx('tap');
  busy = true;
  setTalk(false, 'Listen...');
  await otterSays({ text: `"${item.line}"`, audio: item.audio ? item.audio : null });
  busy = false;
  setTalk(true, attempt ? 'Try again' : 'Hold to talk');
}

function setTalk(enabled, label) {
  const b = $('talk');
  b.disabled = !enabled;
  $('again-line').disabled = !enabled;
  $('talk-label').textContent = label;
}

// ---- talking (hold Space or hold the button)
let session = null;
function beginTalk() {
  if (busy || session || $('talk').disabled) return;
  const item = place.test[index];
  sfx('start');
  setBed('off');
  $('talk').classList.add('recording');
  $('talk-label').textContent = 'Listening...';
  $('heard').textContent = '';
  stage.react('idle');
  live.start();
  session = listen({ expected: item.accepted.concat(item.line), referenceUrl: item.audio });
}

async function endTalk() {
  if (!session) return;
  const s = session;
  session = null;
  $('talk').classList.remove('recording', 'voiced');
  live.stop();
  busy = true;
  setTalk(false, 'Hmm...');
  s.stop();
  const r = await s.result;
  setBed('full');
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
  const b = band(score);
  $('heard').textContent = `Heard: "${r.transcript}"  ·  ${Math.round(score * 100)}%`;
  if (b !== 'good') $('tip').textContent = `Tip: ${item.tip}`;
  sfx(b);
  const d = trustDelta(score);
  setTrust(trust + d);
  floatPop(`${d >= 0 ? '+' : ''}${d} trust`, b === 'bad' ? 'bad' : b === 'good' ? 'good' : '');
  streak = b === 'good' ? streak + 1 : 0;
  if (streak >= 2) floatPop(`Streak x${streak}!`, 'streak', 250);
  await otterSays(item.reactions[b], b);
  // a bad first go gets one more try: the otter waits for you to have another go
  if (b === 'bad' && attempt === 0) {
    attempt = 1;
    busy = false;
    setTalk(true, 'Try again');
    return;
  }
  scores.push(score);
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
  $('bubble').classList.remove('show');
  showResult(p.average, p.level);
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
$('again-line').addEventListener('click', replayLine);
$('again').addEventListener('click', () => {
  sfx('tap');
  startTest();
});
$('to-map').addEventListener('click', () => {
  sfx('tap');
  $('bubble').classList.remove('show');
  show('map');
});
// Title popups: Settings and Credits (Esc or the dark backdrop closes them)
function openModal(id) {
  sfx('tap');
  $(id).classList.add('open');
  $(id).querySelector('.close').focus();
}
function closeModals() {
  document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
}
$('open-settings').addEventListener('click', () => openModal('settings'));
$('open-credits').addEventListener('click', () => openModal('credits'));
document.querySelectorAll('.modal').forEach((m) =>
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) {
      sfx('tap');
      closeModals();
    }
  }),
);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModals();
});
$('set-sound').addEventListener('change', (e) => {
  setMuted(!e.target.checked);
  $('mute').textContent = isMuted() ? 'Sound off' : 'Sound on';
  sfx('tap');
});
$('set-motion').addEventListener('change', (e) => {
  document.body.classList.toggle('reduce', e.target.checked);
  sfx('tap');
});

$('start-learning').addEventListener('click', () => {
  sfx('tap');
  show('learn');
  lessons.open(placedAt, { skipped: placedAt > 0 });
});
$('learn-back').addEventListener('click', () => {
  sfx('tap');
  show('map');
});
// Demo shortcut without a mic: #good or #bad jumps straight to the result.
if (location.hash === '#good' || location.hash === '#bad') {
  const avg = location.hash === '#good' ? 0.82 : 0.31;
  showResult(avg, placement([avg], place.path).level);
}

$('mute').addEventListener('click', () => {
  setMuted(!isMuted());
  $('mute').textContent = isMuted() ? 'Sound off' : 'Sound on';
  $('set-sound').checked = !isMuted();
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
