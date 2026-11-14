// Pure pitch + melody/rhythm comparison. No browser APIs, so it runs in tests.
const MIN_HZ = 70;
const MAX_HZ = 500;
const HOP_S = 0.01;
export const POINTS = 60;

// YIN: the lag where the frame best matches itself shifted. Returns Hz, or 0 if unvoiced.
export function detectPitch(buf, sr) {
  const maxLag = Math.min(Math.floor(sr / MIN_HZ), (buf.length >> 1) - 1);
  const minLag = Math.max(2, Math.floor(sr / MAX_HZ));
  const n = buf.length - maxLag - 1;
  const d = new Float64Array(maxLag + 2);
  let sum = 0;
  for (let lag = 1; lag <= maxLag + 1; lag += 1) {
    let s = 0;
    for (let i = 0; i < n; i += 1) {
      const x = buf[i] - buf[i + lag];
      s += x * x;
    }
    sum += s;
    d[lag] = sum ? (s * lag) / sum : 1;
  }
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (d[lag] < 0.15) {
      while (lag < maxLag && d[lag + 1] < d[lag]) lag += 1;
      const [a, b, c] = [d[lag - 1], d[lag], d[lag + 1]];
      const den = a - 2 * b + c;
      return sr / (lag + (den ? (a - c) / (2 * den) : 0));
    }
  }
  return 0;
}

// Pitch (Hz, 0 = silent/unvoiced) and loudness every 10 ms.
export function contour(samples, sr) {
  const hop = Math.round(sr * HOP_S);
  const win = Math.ceil((2 * sr) / MIN_HZ) + 4;
  const hz = [];
  const rms = [];
  for (let i = 0; i + win <= samples.length; i += hop) {
    const frame = samples.subarray(i, i + win);
    let e = 0;
    for (const x of frame) e += x * x;
    rms.push(Math.sqrt(e / win));
    hz.push(detectPitch(frame, sr));
  }
  const floor = Math.max(0.002, 0.1 * rms.reduce((m, x) => Math.max(m, x), 0));
  return { hz: hz.map((f, i) => (rms[i] > floor ? f : 0)), rms };
}

// Voiced frames only, in semitones around the speaker's median, so a deep voice can match a high otter.
export function semitones(hz) {
  const v = hz.filter((f) => f > 0);
  if (!v.length) return [];
  const med = [...v].sort((a, b) => a - b)[v.length >> 1];
  return v.map((f) => Math.max(-12, Math.min(12, 12 * Math.log2(f / med))));
}

export function resample(a, n = POINTS) {
  if (a.length < 2) return Array(a.length && n).fill(a[0]);
  return Array.from({ length: n }, (_, i) => {
    const t = (i * (a.length - 1)) / (n - 1);
    const j = Math.floor(t);
    return j + 1 < a.length ? a[j] + (a[j + 1] - a[j]) * (t - j) : a[j];
  });
}

// Asymmetric DTW: each ref point matches exactly one of yours (local tempo 0..2x), so a flat line
// can't hide by parking on the ref's zero crossings. Mean |difference| per ref point.
export function dtw(you, ref) {
  let prev = null;
  for (const r of ref) {
    const cur = you.map((y, i) => {
      const best = prev ? Math.min(prev[i], prev[i - 1] ?? Infinity, prev[i - 2] ?? Infinity) : i ? Infinity : 0;
      return best + Math.abs(y - r);
    });
    prev = cur;
  }
  return prev[you.length - 1] / ref.length;
}

// Loudness from first to last loud frame, 0..1, so syllable timing lines up regardless of length.
function envelope(rms) {
  const peak = rms.reduce((m, x) => Math.max(m, x), 0) || 1;
  const first = rms.findIndex((x) => x > 0.1 * peak);
  const last = rms.findLastIndex((x) => x > 0.1 * peak);
  return resample(rms.slice(first, last + 1).map((x) => x / peak));
}

const toScore = (dist, good, bad) => Math.max(0, Math.min(1, (bad - dist) / (bad - good)));

// shortcut: good/bad distances are guesses from synthetic tones, retune on real otter + player clips.
export function accent(youSamples, refSamples, sr) {
  const y = contour(youSamples, sr);
  const r = contour(refSamples, sr);
  const ys = semitones(y.hz);
  const rs = semitones(r.hz);
  if (ys.length < 10 || rs.length < 10) return null;
  const pitch = { you: resample(ys), ref: resample(rs) };
  const melody = toScore(dtw(pitch.you, pitch.ref), 0.7, 2.5);
  const ye = envelope(y.rms);
  const re = envelope(r.rms);
  const rhythm = toScore(ye.reduce((s, x, i) => s + Math.abs(x - re[i]), 0) / POINTS, 0.1, 0.4);
  return { accentScore: 0.7 * melody + 0.3 * rhythm, pitch };
}
