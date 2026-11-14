# Voice (lane 2 owns this folder)

## The contract (don't change the shape; lane 1 depends on it)
```js
import { listen, isSupported } from './voice/index.js';

const session = listen({
  expected: ['it\'s a braw day', ...], // accepted transcripts, lowercase
  referenceUrl: 'assets/audio/scotland/braw.mp3', // the otter's clip, may be missing
});
// call session.stop() when the player releases the talk button
const result = await session.result;
// result = { transcript, wordScore, accentScore, score, pitch: { you: number[], ref: number[] } }
// every score is 0..1. accentScore is null if it couldn't be measured. score = the one to use.
```

## What's there now
- ElevenLabs speech-to-text on the server (`POST /api/stt`) for the transcript. Chrome's own recognition is not used (Sadman, Nov 14: it drops Scots words like "aye").
- `wordScore` = best fuzzy match of the transcript against `expected`.
- `accentScore` (`pitch.js`): mic recorded with `MediaRecorder`, mic + `referenceUrl` decoded at 16 kHz, YIN pitch
  every 10 ms, semitones around each speaker's median, DTW on 60-point contours (70%) + loudness timing (30%).
- `score` = 0.5 * wordScore + 0.5 * accentScore. No mic, missing/bad clip or too little voice: `accentScore` and
  `pitch` are null, `score` = wordScore.

## What lane 2 adds
1. Record the mic with `getUserMedia` + Web Audio while recognition runs.
2. Pitch per ~10 ms frame (autocorrelation/YIN) + loudness; same for the reference clip (decode with `AudioContext.decodeAudioData`).
3. Normalise pitch (semitones relative to each speaker's median), compare contours with DTW -> `accentScore`.
4. `score = 0.5 * wordScore + 0.5 * accentScore` (when accentScore exists). Be generous: judges should feel good.
5. Return both contours in `pitch` so the UI can draw "your melody vs. the otter's".
6. Unit tests for the DTW and pitch functions in `tests/voice*.test.js` (pure functions, no mic).
