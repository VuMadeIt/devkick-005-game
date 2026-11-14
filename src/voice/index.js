// Voice contract (see README.md). Words from browser speech recognition, accent from the mic vs. the otter's clip.
import { wordScore } from './match.js';
import { accent } from './pitch.js';

const Recognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const SR = 16000; // decode straight to 16 kHz: plenty for voice pitch, keeps YIN fast

export function isSupported() {
  return Boolean(Recognition);
}

let decoder;
async function decode(buf) {
  decoder ??= new OfflineAudioContext(1, 1, SR);
  return (await decoder.decodeAudioData(buf)).getChannelData(0);
}

// shortcut: on some Android Chrome builds the mic can't be shared with recognition; accent is then null.
async function record() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  return () =>
    new Promise((res) => {
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        res(new Blob(chunks, { type: rec.mimeType }));
      };
      rec.stop();
    });
}

export function listen({ expected = [], referenceUrl = null } = {}) {
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
    const mic = record().catch(() => null);
    const ref = referenceUrl
      ? fetch(referenceUrl)
          .then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((b) => b && decode(b))
          .catch(() => null)
      : null;
    // Any failure (no mic, missing or bad clip, too little voice) means null: words only.
    const measure = async () => {
      try {
        const [blob, refAudio] = await Promise.all([mic.then((stopMic) => stopMic?.()), ref]);
        return blob?.size && refAudio ? accent(await decode(await blob.arrayBuffer()), refAudio, SR) : null;
      } catch {
        return null;
      }
    };
    const finish = async (error) => {
      if (done) return;
      done = true;
      const transcript = heard.join(' ').trim();
      const ws = wordScore(transcript, expected);
      const m = await Promise.race([measure(), new Promise((res) => setTimeout(res, 1500, null))]);
      const accentScore = m?.accentScore ?? null;
      const score = accentScore === null ? ws : 0.5 * ws + 0.5 * accentScore;
      resolve({ transcript, wordScore: ws, accentScore, score, pitch: m?.pitch ?? null, error });
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
