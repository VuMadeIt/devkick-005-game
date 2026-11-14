// Voice contract (see README.md). Working fallback: browser speech recognition, no accent score yet.
import { wordScore } from './match.js';

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

export function isSupported() {
  return Boolean(Recognition);
}

export function listen({ expected = [], referenceUrl = null } = {}) {
  void referenceUrl; // lane 2: compare the player's pitch with this clip
  let stop = () => {};
  const result = new Promise((resolve) => {
    if (!Recognition) {
      resolve({ transcript: '', wordScore: 0, accentScore: null, score: 0, pitch: null, error: 'unsupported' });
      return;
    }
    const rec = new Recognition();
    rec.lang = 'en-GB';
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = true;
    const heard = [];
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      const transcript = heard.join(' ').trim();
      const ws = wordScore(transcript, expected);
      resolve({ transcript, wordScore: ws, accentScore: null, score: ws, pitch: null, error });
    };
    rec.onresult = (e) => {
      heard.length = 0;
      for (const r of e.results) {
        // pick the alternative closest to what we expect
        let best = r[0].transcript;
        let bestScore = -1;
        for (const alt of r) {
          const s = wordScore(alt.transcript, expected);
          if (s > bestScore) {
            bestScore = s;
            best = alt.transcript;
          }
        }
        heard.push(best);
      }
    };
    rec.onerror = (e) => finish(e.error);
    rec.onend = () => finish();
    try {
      rec.start();
    } catch (err) {
      finish(String(err));
    }
    stop = () => {
      setTimeout(() => {
        try {
          rec.stop();
        } catch {
          finish();
        }
      }, 250); // keep listening a moment after release so the last word lands
      setTimeout(() => finish('timeout'), 4000);
    };
  });
  return { result, stop: () => stop() };
}
