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

// Backup ears: send the recording to ElevenLabs (via /api/stt) when Chrome's recognition missed or
// misheard the line. Short Scots words like "aye" are often dropped by Chrome.
async function serverTranscript(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch('api/stt', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audio: btoa(bin), audioType: blob.type }),
      signal: ctrl.signal,
    });
    if (!res.ok) return '';
    return String((await res.json()).text || '');
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
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
    let blobP = null;
    const recording = () => (blobP ??= mic.then((stopMic) => stopMic?.()).catch(() => null));
    const measure = async () => {
      try {
        const [blob, refAudio] = await Promise.all([recording(), ref]);
        return blob?.size && refAudio ? accent(await decode(await blob.arrayBuffer()), refAudio, SR) : null;
      } catch {
        return null;
      }
    };
    const finish = async (error) => {
      if (done) return;
      done = true;
      let transcript = heard.join(' ').trim();
      let ws = wordScore(transcript, expected);
      if (ws < 0.75) {
        const blob = await recording();
        if (blob?.size > 1500) {
          const backup = (await serverTranscript(blob)).replace(/[.,!?]+$/g, '').trim();
          const bs = wordScore(backup, expected);
          if (backup && (bs > ws || !transcript)) {
            transcript = backup;
            ws = bs;
          }
        }
      }
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
