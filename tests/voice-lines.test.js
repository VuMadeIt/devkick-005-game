import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { collectLines, buildJobs } from '../scripts/voice-lines.js';
import scotland from '../src/content/scotland.json';
import voiceConfig from '../scripts/voice-config.json';

describe('voice line jobs', () => {
  it('collects intro, outro, each test line and its three reactions', () => {
    expect(collectLines(scotland)).toHaveLength(2 + scotland.test.length * 4);
  });

  it('adds direction tags to reactions but keeps reference lines plain', () => {
    const jobs = buildJobs(scotland, voiceConfig.scotland);
    const byFile = Object.fromEntries(jobs.map((j) => [j.audio.split('/').pop(), j.prompt]));
    expect(byFile['intro.mp3']).toMatch(/^\[suspicious\] /);
    for (const item of scotland.test) expect(byFile[item.audio.split('/').pop()]).toBe(item.line);
  });

  it('skips lines without text or audio', () => {
    expect(collectLines({ character: { intro: { text: 'hi' } }, test: [] })).toEqual([]);
  });

  it('has an mp3 in public/ for every line in scotland.json', () => {
    const missing = collectLines(scotland).filter((l) => !existsSync(`public/${l.audio}`));
    expect(missing).toEqual([]);
  });
});
