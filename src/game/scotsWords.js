// Glaswegian words the player can collect in free talk. Each pattern also accepts the ways
// speech-to-text tends to spell them. Pure, so it runs in tests.
export const SCOTS_WORDS = [
  { id: 'aye', label: 'aye', means: 'yes', re: /\b(aye|ay)\b/ },
  { id: 'wee', label: 'wee', means: 'small', re: /\bwee\b/ },
  { id: 'pal', label: 'pal', means: 'friend', re: /\bpal\b/ },
  { id: 'gaun', label: 'how’s it gaun', means: 'how’s it going', re: /\bhow'?s it (gaun|gaan|gawn|gan|goin)\b/ },
  { id: 'nae', label: 'cannae / dinnae', means: "can't / don't", re: /\b\w+nae\b|\bnae\b/ },
  { id: 'ken', label: 'ken', means: 'know', re: /\bken\b/ },
  { id: 'messages', label: 'messages', means: 'the shopping', re: /\bmessages\b/ },
  { id: 'scran', label: 'scran', means: 'food', re: /\bscran\b/ },
  { id: 'irnbru', label: 'Irn-Bru', means: 'the orange fizzy drink', re: /\b(irn|iron)[- ]?(bru|brew)\b/ },
  { id: 'baltic', label: 'baltic', means: 'freezing', re: /\bbaltic\b/ },
  { id: 'weans', label: 'weans', means: 'kids', re: /\bweans?\b/ },
  { id: 'pure', label: 'pure dead', means: 'really, very', re: /\bpure dead\b/ },
];

const norm = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9' -]+/g, ' ');

// ids of every Scots word in this text
export function findScots(text) {
  const t = norm(text);
  return SCOTS_WORDS.filter((w) => w.re.test(t)).map((w) => w.id);
}
