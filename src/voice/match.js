// Pure text matching: how close is what we heard to any accepted line? 0..1.
export function normalise(s) {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function similarity(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  if (!x && !y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

export function wordScore(transcript, expected) {
  if (!transcript) return 0;
  return Math.max(0, ...expected.map((e) => similarity(transcript, e)));
}
