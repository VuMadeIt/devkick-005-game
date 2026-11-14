// Lane 1: game shell. Title -> world map -> otter placement test -> result path.
import './ui/styles.css';
import scotland from './content/scotland.json';
import { createStage } from './game/otterScene.js';
import { say, sfx, setMuted, isMuted, unlockAudio, startBed, setBed } from './game/audio.js';
import { band, clampTrust, placement, trustDelta } from './game/placement.js';
import { listen, isSupported } from './voice/index.js';
import { createLive } from './game/liveVoice.js';
import { createLessons } from './ui/lessons.js';
import { newChat, applyTurn, lineFrom, talk as askOtter, START_TRUST } from './game/conversation.js';
import { startRecording, blobToBase64 } from './voice/record.js';
import flowers from './content/flowers.json';
import { turn } from './game/flowers.js';

const $ = (id) => document.getElementById(id);
const stage = createStage($('stage'));
if (import.meta.env.DEV) window.__stage = stage; // dev-only hook for checking otter reactions
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
  // after free-talk practice, offer the test straight away
  if (id === 'result') $('result-test').hidden = mode === 'test';
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
let mode = 'chat'; // 'chat': free talk with the otter (Claude + ElevenLabs); 'test': scripted accent test
let chat = newChat();
let lastOtterLine = null;
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

// ---- free talk: say anything; the otter (Claude) answers in his ElevenLabs voice and decides how far
// he trusts you. Speech-to-text runs on the server (ElevenLabs Scribe), so any browser with a mic works.
const MAX_CHAT_TURNS = 8;
const MIN_ANSWER_BYTES = 2000; // shorter than this is a tap, not speech
const CHAT_OPENERS = ['Aye, how’s it gaun?', 'Ah’m jist oot fur ma messages.', 'Fancy a wee Irn-Bru?'];
const THINKING = [
  { text: 'Hmm... let me think aboot that.', audio: 'assets/audio/scotland/think-1.mp3' },
  { text: 'Mmm-hmm... is that right, aye?', audio: 'assets/audio/scotland/think-2.mp3' },
  { text: 'Oh aye? Go on...', audio: 'assets/audio/scotland/think-3.mp3' },
  { text: 'Hmmm. We’ll see aboot that.', audio: 'assets/audio/scotland/think-4.mp3' },
];
const OUTCOME_NOTE = {
  local: 'The Devin Otter says you’re a real Glaswegian!',
  busted: 'Busted! The otter spotted the tourist.',
  out_of_time: 'The otter has to get his messages.',
};

function showIntro() {
  $('bubble').classList.remove('show');
  stage.react('idle');
  show('intro');
  popIn($('intro').querySelector('.popup'));
}

function showChatPanel() {
  $('step').textContent = `Turn ${Math.min(chat.turn + 1, MAX_CHAT_TURNS)} / ${MAX_CHAT_TURNS}`;
  $('level').textContent = 'Free talk';
  $('line').textContent = 'Convince the otter you’re a real Glaswegian';
  $('meaning').textContent = `Say anything. Try: “${CHAT_OPENERS[chat.turn % CHAT_OPENERS.length]}”`;
  $('melody').classList.remove('show');
  live.hide();
}

function readyToTalk(note) {
  if (note !== undefined) $('heard').textContent = note;
  busy = false;
  setTalk(true, 'Hold to talk');
}

async function startChat() {
  mode = 'chat';
  $('again-line').hidden = false;
  $('speaker').textContent = place.character.name;
  chat = newChat();
  streak = 0;
  setTrust(START_TRUST);
  show('test');
  busy = true;
  setTalk(false, 'Listen...');
  showChatPanel();
  $('heard').textContent = '';
  $('tip').textContent = '';
  popIn($('prompt'));
  stage.react('suspicious');
  await new Promise((res) => setTimeout(res, 700)); // a beat: he sizes you up before speaking
  lastOtterLine = place.character.intro;
  await otterSays(lastOtterLine, 'suspicious');
  readyToTalk();
}

// blob: the recorded answer, transcribed by ElevenLabs Scribe on the server.
async function chatTurn(blob) {
  if (!blob || blob.size < MIN_ANSWER_BYTES) return readyToTalk('Hold the button down while you talk.');
  $('heard').textContent = 'You: …';
  setTalk(false, 'The otter is thinking...');
  // Send first, then fill the wait with a thinking line while the answer is on its way.
  const pending = blobToBase64(blob)
    .then((audio) => askOtter(chat, { audio, audioType: blob.type }))
    .then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
  await otterSays(THINKING[Math.floor(Math.random() * THINKING.length)], 'suspicious');
  stage.react('suspicious');
  const { value: answer, error } = await pending;
  if (error) {
    console.warn('[chat] /api/otter failed:', error.message);
    await otterSays({ text: 'Sorry pal, couldnae hear ye ower the rain. Say that again?' }, 'ok');
    return readyToTalk('');
  }
  const said = answer.heard || '';
  $('heard').textContent = said ? `You: “${said}”` : 'The otter didn’t catch that...';
  chat = applyTurn(chat, said, answer);
  setTrust(answer.trust);
  const kind = answer.delta >= 8 ? 'good' : answer.delta >= 0 ? 'ok' : 'bad';
  sfx(kind);
  floatPop(`${answer.delta >= 0 ? '+' : ''}${answer.delta} trust`, kind === 'ok' ? '' : kind);
  streak = kind === 'good' ? streak + 1 : 0;
  if (streak >= 2) floatPop(`Streak x${streak}!`, 'streak', 250);
  $('tip').textContent = answer.hint ? `Tip: ${answer.hint}` : '';
  showChatPanel();
  lastOtterLine = lineFrom(answer);
  await otterSays(lastOtterLine, answer.mood);
  if (answer.outcome !== 'continue') {
    await new Promise((res) => setTimeout(res, 600));
    await finishChat(answer.outcome);
    return;
  }
  readyToTalk();
}

async function finishChat(outcome) {
  const average = trust / 100;
  const p = placement([average], place.path);
  $('bubble').classList.remove('show');
  showResult(average, p.level);
  $('result-note').textContent = `${OUTCOME_NOTE[outcome] ?? ''} ${$('result-note').textContent}`.trim();
  stage.react(p.index >= 2 ? 'good' : 'ok');
  if (p.level.celebration) {
    setBed('off');
    await say(p.level.celebration);
    setBed('full');
  } else {
    sfx('level');
  }
}

async function startTest() {
  mode = 'test';
  $('again-line').hidden = false;
  $('speaker').textContent = place.character.name;
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
  if (mode === 'chat') {
    if (!lastOtterLine) return;
    sfx('tap');
    busy = true;
    setTalk(false, 'Listen...');
    await otterSays(lastOtterLine, 'talk');
    return readyToTalk();
  }
  const item = place.test[index];
  sfx('tap');
  busy = true;
  setTalk(false, 'Listen...');
  await otterSays(mode === 'flowers' ? { text: $('bubble-text').textContent } : { text: `"${item.line}"`, audio: item.audio ? item.audio : null });
  busy = false;
  setTalk(true, attempt ? 'Try again' : 'Hold to talk');
}

function setTalk(enabled, label) {
  const b = $('talk');
  b.disabled = !enabled;
  $('again-line').disabled = !enabled;
  $('talk-label').textContent = label;
}

// ---- free talk: sell Morag some flowers (src/content/flowers.json)
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
  live.hide();
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
  $('result-level').textContent = t.ending === 'buy' ? 'Bought your flowers!' : 'Walked off';
  $('result-score').textContent = String(t.state.mood);
  $('result-note').textContent = t.ending === 'buy' ? 'Morag took ye for a local.' : 'Try sounding more local: aye, hen, wee, quid.';
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
  if (mode === 'chat') {
    const recording = startRecording();
    recording.catch(() => {}); // handled in endChatTalk
    session = { recording };
    live.start().then(() => $('match').classList.remove('show')); // mic ring + otter leaning in
    return;
  }
  live.start();
  if (mode === 'flowers') live.hide(); // no reference clip here: keep the mic ring, drop "Match %"
  const item = place.test[index];
  session = mode === 'flowers' ? listen() : listen({ expected: item.accepted.concat(item.line), referenceUrl: item.audio });
}

async function endChatTalk(recording) {
  let blob = null;
  try {
    blob = await (await recording).stop();
  } catch (err) {
    setBed('full');
    const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
    console.warn('[chat] recording failed:', err?.name, err?.message);
    return readyToTalk(denied ? 'Allow the microphone to play.' : 'Could not use the microphone. Check your mic settings.');
  }
  setBed('full');
  await chatTurn(blob);
}

async function endTalk() {
  if (!session) return;
  const s = session;
  session = null;
  $('talk').classList.remove('recording', 'voiced');
  live.stop();
  busy = true;
  setTalk(false, 'Hmm...');
  if (s.recording) return endChatTalk(s.recording);
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
  // Free talk only needs a mic recorder (speech-to-text runs on the server), so most browsers work.
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
    alert('This browser cannot use the microphone. Please open the game in Chrome, Edge, Safari or Firefox.');
    return;
  }
  showIntro();
});
$('intro-start').addEventListener('click', () => {
  sfx('tap');
  startChat();
});
$('intro-test').addEventListener('click', () => {
  sfx('tap');
  // The scripted test uses the browser's speech recognition, which only works in Google Chrome.
  if (!isSupported()) {
    alert('The accent test needs Google Chrome. Free talk works in this browser.');
    return;
  }
  startTest();
});
$('intro-flowers').addEventListener('click', () => $('pin-flowers').click());
$('result-test').addEventListener('click', () => $('intro-test').click());
$('again-line').addEventListener('click', replayLine);
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
  if (mode === 'chat') startChat();
  else if (mode === 'flowers') startFlowers();
  else startTest();
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
