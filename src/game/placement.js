// Pure scoring rules for the placement test. Generous on purpose: judges should feel good.
export function band(score) {
  if (score >= 0.7) return 'good';
  if (score >= 0.4) return 'ok';
  return 'bad';
}

// Trust meter change for one answer, in meter points (meter runs 0..100, starts at 30).
export function trustDelta(score) {
  return Math.round((score - 0.35) * 60);
}

export function clampTrust(v) {
  return Math.max(0, Math.min(100, v));
}

export function placement(scores, path) {
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  let level = path[0];
  for (const p of path) if (avg >= p.minScore) level = p;
  return { average: avg, level, index: path.indexOf(level) };
}
