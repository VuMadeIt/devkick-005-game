// Duolingo-style lesson path (placeholders). Units of 10 lessons, zigzag nodes, a sticky unit header that
// follows the scroll, and a jump button back to your lesson. Lessons do nothing yet when tapped.
const UNITS = [
  ['Hello and aye', 'red'],
  ['At the chippy', 'teal'],
  ['Asking directions', 'yellow'],
  ['Talking weather', 'green'],
  ['On the bus', 'purple'],
  ['Down the pub', 'red'],
  ['Fitba chat', 'teal'],
  ['Family and pals', 'yellow'],
];
const PER_UNIT = 10;
const SWING = [0, 44, 72, 44, 0, -44, -72, -44]; // px sideways, the Duolingo zigzag

const ICON = {
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke-width="2.6"/><rect x="5" y="11" width="14" height="10" rx="2.5"/>',
  chest: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M3 9a9 6 0 0 1 18 0z"/><rect x="10.5" y="11" width="3" height="4" rx="1" class="cut"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0zM4 5h3v3a3 3 0 0 1-3-3zM20 5h-3v3a3 3 0 0 0 3-3zM10 14h4v3h-4zM7 18h10v3H7z"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;

export function createLessons({ root, onTap = () => {} }) {
  const scroll = root.querySelector('#learn-scroll');
  const track = root.querySelector('#track');
  const head = root.querySelector('#unit-head');
  const jump = root.querySelector('#jump');
  let current = 0;
  let currentEl = null;

  function render(cur) {
    current = cur;
    track.innerHTML = '';
    UNITS.forEach(([title, color], u) => {
      const unit = document.createElement('div');
      unit.className = `unit ${color}`;
      unit.dataset.unit = u;
      unit.innerHTML = `<div class="divider"><span>${title}</span></div>`;
      for (let i = 0; i < PER_UNIT; i += 1) {
        const n = u * PER_UNIT + i;
        const kind = i === PER_UNIT - 1 ? 'trophy' : i === 4 ? 'chest' : 'lesson';
        const state = n < cur ? 'done' : n === cur ? 'current' : 'locked';
        const b = document.createElement('button');
        b.className = `node ${kind} ${state}`;
        b.style.setProperty('--x', `${SWING[n % SWING.length]}px`);
        b.setAttribute('aria-label', `Lesson ${n + 1}${state === 'locked' ? ', locked' : ''}`);
        const icon = kind !== 'lesson' ? kind : state === 'done' ? 'check' : state === 'locked' ? 'lock' : 'star';
        b.innerHTML = `${state === 'current' ? '<span class="start">Start</span><span class="ring"></span>' : ''}<span class="face">${svg(icon)}</span><span class="num">${n + 1}</span>`;
        b.addEventListener('click', () => {
          if (state === 'locked') {
            b.classList.remove('nudge');
            void b.offsetWidth;
            b.classList.add('nudge');
          }
          onTap({ lesson: n + 1, state, kind });
        });
        if (state === 'current') currentEl = b;
        unit.appendChild(b);
      }
      track.appendChild(unit);
    });
    updateHead();
  }

  // position of an element inside the scrolling content, whatever its CSS parents are
  const topOf = (el) => el.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;

  function updateHead() {
    const units = track.querySelectorAll('.unit');
    const top = scroll.scrollTop + 8;
    let active = units[0];
    for (const u of units) if (topOf(u) <= top) active = u;
    const i = Number(active.dataset.unit);
    const [title, color] = UNITS[i];
    head.className = `unit-head ${color}`;
    head.querySelector('#uh-sec').textContent = `Section 1, Unit ${i + 1}`;
    head.querySelector('#uh-title').textContent = title;
    // jump button: show when your lesson is off screen, pointing toward it
    if (currentEl) {
      const y = topOf(currentEl) - scroll.scrollTop;
      const off = y < 0 || y > scroll.clientHeight - 40;
      jump.classList.toggle('show', off);
      jump.classList.toggle('up', y < 0);
    }
  }

  function scrollToCurrent(smooth = true) {
    if (!currentEl) return;
    const y = topOf(currentEl) - scroll.clientHeight / 2 + 40;
    scroll.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
  }

  scroll.addEventListener('scroll', updateHead, { passive: true });
  jump.addEventListener('click', () => scrollToCurrent(true));

  return {
    // skipped = placed ahead: start at the top, then glide down past the skipped lessons
    open(cur, { skipped = false } = {}) {
      render(cur);
      scroll.scrollTop = 0;
      if (skipped) setTimeout(() => scrollToCurrent(true), 700);
      else requestAnimationFrame(() => scrollToCurrent(false));
      updateHead();
    },
    get current() {
      return current;
    },
  };
}
