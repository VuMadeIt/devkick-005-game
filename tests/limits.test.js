import { describe, expect, it } from 'vitest';
import { clientIp, createDailyCap, createRateLimiter, maxTurnsPerDay } from '../server/limits.js';

const clock = (t = Date.UTC(2026, 10, 15, 12)) => {
  const c = () => c.t;
  c.t = t;
  return c;
};

describe('per-IP rate limit', () => {
  it('allows 20 a minute, then asks the caller to wait', () => {
    const now = clock();
    const rl = createRateLimiter({ now });
    for (let i = 0; i < 20; i += 1) expect(rl.check('1.2.3.4').ok).toBe(true);
    const no = rl.check('1.2.3.4');
    expect(no).toMatchObject({ ok: false, scope: 'minute' });
    expect(no.retryAfter).toBeGreaterThan(0);
    expect(rl.check('5.6.7.8').ok).toBe(true); // other players are not affected
    now.t += 61_000;
    expect(rl.check('1.2.3.4').ok).toBe(true);
  });
  it('allows 300 a day, then waits until tomorrow (UTC)', () => {
    const now = clock();
    const rl = createRateLimiter({ now, perMinute: 1000 });
    for (let i = 0; i < 300; i += 1) expect(rl.check('ip').ok).toBe(true);
    const no = rl.check('ip');
    expect(no).toMatchObject({ ok: false, scope: 'day', retryAfter: 12 * 3600 });
    now.t += 12 * 3600 * 1000;
    expect(rl.check('ip').ok).toBe(true);
  });
  it('keeps memory bounded under a flood of new IPs', () => {
    const rl = createRateLimiter({ now: clock(), maxKeys: 100 });
    for (let i = 0; i < 1000; i += 1) rl.check(`ip${i}`);
    expect(rl.size()).toBeLessThanOrEqual(100);
  });
});

describe('daily AI turn cap', () => {
  it('stops at the cap and resets the next UTC day', () => {
    const now = clock();
    const cap = createDailyCap({ now });
    expect(cap.take(2)).toBe(true);
    expect(cap.take(2)).toBe(true);
    expect(cap.take(2)).toBe(false);
    expect(cap.used()).toBe(2);
    now.t += 86_400_000;
    expect(cap.take(2)).toBe(true);
  });
  it('reads MAX_AI_TURNS_PER_DAY, default 2000', () => {
    expect(maxTurnsPerDay({})).toBe(2000);
    expect(maxTurnsPerDay({ MAX_AI_TURNS_PER_DAY: '50' })).toBe(50);
    expect(maxTurnsPerDay({ MAX_AI_TURNS_PER_DAY: '0' })).toBe(0);
    expect(maxTurnsPerDay({ MAX_AI_TURNS_PER_DAY: 'lots' })).toBe(2000);
  });
});

describe('clientIp', () => {
  it('uses the first forwarded hop, then the socket', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } })).toBe('9.9.9.9');
    expect(clientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } })).toBe('127.0.0.1');
  });
});
