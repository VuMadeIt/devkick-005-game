// Lane 1: the live "sing along with the otter" view while the player talks.
// The otter's melody (from its ElevenLabs clip) is the amber target; your voice draws over it in blue,
// live, with a match % and a mic ring that grows with your volume. Purely for feel: the real score
// still comes from src/voice (lane 2).
import { contour, detectPitch } from '../voice/pitch.js';

const SR = 16000;
const refCache = new Map();
let decoder;

function semis(hz, med) {
  if (!(hz > 0) || !(med > 0)) return null;
  let s = 12 * Math.log2(hz / med);
  if (Math.abs(s) > 9) s -= 12 * Math.sign(s); // octave slip
  return Math.max(-10, Math.min(10, s));
}

function median(arr) {
  const v = arr.filter((x) => x > 0).sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : 0;
}

// Otter melody: semitones every 10 ms (null = silent), trimmed to the voiced span.
export async function loadReference(url) {
  if (!url) return null;
  if (refCache.has(url)) return refCache.get(url);
  const p = (async () => {
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      decoder ??= new OfflineAudioContext(1, 1, SR);
      const samples = (await decoder.decodeAudioData(buf)).getChannelData(0);
      const { hz } = contour(samples, SR);
      const med = median(hz);
      let a = hz.findIndex((f) => f > 0);
      let b = hz.length - 1;
      while (b > a && !(hz[b] > 0)) b -= 1;
      if (a < 0) return null;
      const st = hz.slice(a, b + 1).map((f) => semis(f, med));
      return { st, seconds: st.length * 0.01 };
    } catch {
      return null;
    }
  })();
  refCache.set(url, p);
  return p;
}

export function createLive(canvas, ring, matchEl) {
  const g = canvas.getContext('2d');
  let ref = null;
  let you = []; // { t: 0..1, s }
  let raf = 0;
  let stream = null;
  let ctx = null;
  let match = 0;
  let onVoice = () => {};

  function size() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
  }
  const yOf = (s, h) => h / 2 - (s / 10) * (h * 0.42);

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (ref) {
      // otter target: thick soft band + line
      for (const [lw, col] of [
        [h * 0.22, 'rgba(242,166,35,0.22)'],
        [Math.max(3, h * 0.06), '#e8961b'],
      ]) {
        g.lineWidth = lw;
        g.strokeStyle = col;
        g.beginPath();
        let pen = false;
        ref.st.forEach((s, i) => {
          if (s === null) return (pen = false);
          const x = (i / (ref.st.length - 1)) * w;
          if (pen) g.lineTo(x, yOf(s, h));
          else g.moveTo(x, yOf(s, h));
          pen = true;
        });
        g.stroke();
      }
    }
    g.lineWidth = Math.max(3, h * 0.07);
    g.strokeStyle = '#2f6bd8';
    g.beginPath();
    let last = null;
    for (const p of you) {
      if (p.s === null) {
        last = null;
        continue;
      }
      const x = p.t * w;
      if (last) g.lineTo(x, yOf(p.s, h));
      else g.moveTo(x, yOf(p.s, h));
      last = p;
    }
    g.stroke();
    const tip = you[you.length - 1];
    if (tip && tip.s !== null) {
      g.fillStyle = '#2f6bd8';
      g.beginPath();
      g.arc(tip.t * w, yOf(tip.s, h), Math.max(5, h * 0.1), 0, Math.PI * 2);
      g.fill();
    }
  }

  async function show(url) {
    you = [];
    match = 0;
    matchEl.textContent = '';
    canvas.classList.add('show');
    size();
    ref = null;
    draw();
    ref = await loadReference(url);
    draw();
  }

  async function start() {
    you = [];
    match = 0;
    matchEl.textContent = 'Match 0%';
    matchEl.classList.add('show');
    size();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
    } catch {
      return; // no live view; scoring still works
    }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().catch(() => {});
    const an = ctx.createAnalyser();
    an.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    const sr = ctx.sampleRate;
    const voiced = [];
    const span = (ref?.seconds || 1.5) * 1.25 + 0.3;
    const t0 = performance.now();
    let frame = 0;
    let hits = 0;
    let tries = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      an.getFloatTimeDomainData(buf);
      let e = 0;
      for (const x of buf) e += x * x;
      const rms = Math.sqrt(e / buf.length);
      const vol = Math.min(1, rms * 12);
      ring.style.setProperty('--vol', vol.toFixed(3));
      frame += 1;
      if (frame % 2) return;
      const t = Math.min(1, (performance.now() - t0) / 1000 / span);
      // downsample 2x for speed; pitch range is still fine
      const half = new Float32Array(buf.length >> 1);
      for (let i = 0; i < half.length; i += 1) half[i] = (buf[2 * i] + buf[2 * i + 1]) / 2;
      const hz = rms > 0.012 ? detectPitch(half, sr / 2) : 0;
      if (hz > 0) voiced.push(hz);
      const s = semis(hz, median(voiced.slice(-60)));
      you.push({ t, s });
      onVoice(s !== null, vol);
      if (s !== null && ref) {
        const ri = Math.round(t * (ref.st.length - 1));
        let best = null;
        for (let k = -8; k <= 8; k += 1) {
          const r = ref.st[ri + k];
          if (r !== null && r !== undefined && (best === null || Math.abs(r - s) < Math.abs(best - s))) best = r;
        }
        if (best !== null) {
          tries += 1;
          if (Math.abs(best - s) < 2.5) hits += 1;
          match = Math.round((hits / tries) * 100);
          matchEl.textContent = `Match ${match}%`;
        }
      }
      draw();
    };
    tick();
  }

  function stop() {
    cancelAnimationFrame(raf);
    ring.style.setProperty('--vol', '0');
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    ctx?.close().catch(() => {});
    ctx = null;
    draw();
    return match;
  }

  function hide() {
    canvas.classList.remove('show');
    matchEl.classList.remove('show');
  }

  window.addEventListener('resize', () => {
    if (canvas.classList.contains('show')) {
      size();
      draw();
    }
  });
  return { show, start, stop, hide, onVoice: (fn) => (onVoice = fn) };
}
