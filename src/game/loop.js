// Fixed-step game loop: gameplay updates at a steady 120 Hz (same as the organizers' Downhill),
// rendering runs once per animation frame. Keeps physics the same on fast PCs and slow phones.
export const STEP = 1 / 120;
const MAX_FRAME = 0.25; // never simulate more than this after a tab switch or hitch

export function stepsFor(accumulator, frameDt) {
  let acc = accumulator + Math.min(frameDt, MAX_FRAME);
  let steps = 0;
  while (acc >= STEP) {
    acc -= STEP;
    steps += 1;
  }
  return { steps, accumulator: acc };
}

export function createLoop({ update, render, now = () => performance.now() / 1000 }) {
  let last = 0;
  let acc = 0;
  let running = false;

  function frame() {
    if (!running) return;
    const t = now();
    const r = stepsFor(acc, t - last);
    last = t;
    acc = r.accumulator;
    for (let i = 0; i < r.steps; i += 1) update(STEP);
    render(acc / STEP);
    requestAnimationFrame(frame);
  }

  return {
    start() {
      running = true;
      last = now();
      requestAnimationFrame(frame);
    },
    stop() {
      running = false;
    },
  };
}
