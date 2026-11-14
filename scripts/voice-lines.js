// Pure helpers for generate-voice.js: turn a place's content JSON into a list of TTS jobs.

// Every { text, audio } line in a place: intro, outro, each test line, each reaction.
export function collectLines(place) {
  const lines = [place.character?.intro, place.character?.outro];
  for (const item of place.test ?? []) {
    lines.push({ text: item.line, audio: item.audio });
    lines.push(...Object.values(item.reactions ?? {}));
  }
  return lines.filter((l) => l?.text && l?.audio);
}

// Adds the voice direction tag (if any) in front of the text.
export function buildJobs(place, config) {
  const direction = config.direction ?? {};
  return collectLines(place).map(({ text, audio }) => {
    const tag = direction[audio.split('/').pop()];
    return { audio, prompt: tag ? `${tag} ${text}` : text };
  });
}
