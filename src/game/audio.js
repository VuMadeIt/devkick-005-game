// Speech + sound effects. Plays the content's mp3 if it exists, otherwise the browser's own voice,
// so missing audio never breaks the demo.
let ctx;
function ac() {
  ctx ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

let muted = false;
export function setMuted(m) {
  muted = m;
  if (m) speechSynthesis.cancel();
  applyBed();
}
export const isMuted = () => muted;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => /fiona/i.test(v.name)) || // macOS Scottish voice
    voices.find((v) => /en[-_](gb|scotland)/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null
  );
}

function speakTts(text) {
  return new Promise((resolve) => {
    if (muted || !globalThis.speechSynthesis) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 0.95;
    u.pitch = 1.15;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
    setTimeout(resolve, 6000);
  });
}

// line = { text, audio }
export async function say(line, onStart) {
  if (!line) return;
  onStart?.();
  if (muted) return new Promise((r) => setTimeout(r, 900));
  if (line.audio) {
    try {
      const el = new Audio(line.audio);
      await new Promise((resolve, reject) => {
        el.oncanplaythrough = resolve;
        el.onerror = reject;
        setTimeout(reject, 1500);
      });
      await el.play();
      await new Promise((r) => {
        el.onended = r;
        setTimeout(r, 8000);
      });
      return;
    } catch {
      /* fall through to TTS */
    }
  }
  await speakTts(line.text);
}

// ---- SFX: lane 3's ElevenLabs mp3s, decoded once; the synth below plays until (or if) they load.
const SFX_DIR = 'assets/audio/sfx/';
const SFX_KINDS = ['tap', 'start', 'good', 'ok', 'bad', 'level'];
const SFX_VOLUME = 0.7;
const sfxBuffers = new Map();

async function loadSfx(kind) {
  try {
    const res = await fetch(`${SFX_DIR}${kind}.mp3`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sfxBuffers.set(kind, await ac().decodeAudioData(await res.arrayBuffer()));
  } catch (err) {
    console.warn(`[audio] sfx "${kind}" unavailable, using synth:`, err.message);
  }
}

export function sfx(kind) {
  if (muted) return;
  const buffer = sfxBuffers.get(kind);
  if (!buffer) return synthSfx(kind);
  const c = ac();
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buffer;
  gain.gain.value = SFX_VOLUME;
  src.connect(gain).connect(c.destination);
  src.start();
}

// ---- Background bed: Glasgow music + street ambience, looping. Duck it under the otter and
// turn it off while the player talks so it never leaks into the mic.
const BED_TRACKS = [
  { src: 'assets/audio/music/glasgow.mp3', volume: 0.3 },
  { src: 'assets/audio/sfx/glasgow-ambience.mp3', volume: 0.2 },
];
const BED_LEVELS = { full: 1, under: 0.35, off: 0 };
let bed = null;
let bedLevel = 'full';

function applyBed() {
  for (const { el, volume } of bed ?? []) el.volume = muted ? 0 : volume * BED_LEVELS[bedLevel];
}

export function startBed() {
  if (bed) return;
  bed = BED_TRACKS.map(({ src, volume }) => {
    const el = new Audio(src);
    el.loop = true;
    return { el, volume };
  });
  applyBed();
  for (const { el } of bed) {
    el.play().catch((err) => console.warn('[audio] background bed did not start:', err.message));
  }
}

// level: 'full' | 'under' | 'off'
export function setBed(level) {
  bedLevel = level in BED_LEVELS ? level : 'full';
  applyBed();
}

// Tiny synth fallback for when an mp3 is missing.
function synthSfx(kind) {
  const c = ac();
  const t = c.currentTime;
  const notes = {
    tap: [[660, 0, 0.06]],
    start: [[520, 0, 0.08]],
    good: [[660, 0, 0.1], [880, 0.09, 0.14], [1320, 0.2, 0.22]],
    ok: [[600, 0, 0.12], [700, 0.1, 0.14]],
    bad: [[300, 0, 0.16], [220, 0.14, 0.22]],
    level: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.35]],
  }[kind] || [[440, 0, 0.1]];
  for (const [f, at, dur] of notes) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = kind === 'bad' ? 'sawtooth' : 'triangle';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + at);
    g.gain.exponentialRampToValueAtTime(0.18, t + at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
    o.connect(g).connect(c.destination);
    o.start(t + at);
    o.stop(t + at + dur + 0.05);
  }
}

export function unlockAudio() {
  ac();
  speechSynthesis?.getVoices();
  for (const kind of SFX_KINDS) if (!sfxBuffers.has(kind)) loadSfx(kind);
}
