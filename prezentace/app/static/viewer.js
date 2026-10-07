const { playlist, start } = JSON.parse(document.getElementById('data').textContent);
const img = document.getElementById('slide');
const blank = document.getElementById('blank');
const bar = document.getElementById('bar');
const $ = (id) => document.getElementById(id);

let pres = start;
let slide = Math.max(1, parseInt(location.hash.slice(1), 10) || 1);

const slideUrl = (p, n) => `/p/${playlist[p].id}/slide/${n}.jpg`;

function show() {
  const p = playlist[pres];
  slide = Math.min(Math.max(slide, 1), p.slides);
  img.src = slideUrl(pres, slide);
  $('title').textContent = p.title;
  $('counter').textContent = `${slide} / ${p.slides}`;
  document.title = p.title;
  history.replaceState(null, '', `/p/${p.id}#${slide}`);
  $('prev-pres').disabled = pres === 0;
  $('next-pres').disabled = pres === playlist.length - 1;
  for (const n of [slide + 1, slide + 2, slide - 1]) {
    if (n >= 1 && n <= p.slides) new Image().src = slideUrl(pres, n);
  }
}

function go(delta) {
  blank.hidden = true;
  slide += delta;
  show();
}

function switchPres(delta) {
  const next = pres + delta;
  if (next < 0 || next >= playlist.length) return;
  pres = next;
  slide = 1;
  blank.hidden = true;
  show();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const actions = {
    ArrowRight: () => go(1), PageDown: () => go(1), ' ': () => go(1), Enter: () => go(1),
    ArrowLeft: () => go(-1), PageUp: () => go(-1), Backspace: () => go(-1),
    Home: () => go(-Infinity), End: () => go(Infinity),
    ArrowUp: () => switchPres(-1), ArrowDown: () => switchPres(1),
    f: toggleFullscreen, F: toggleFullscreen,
    b: () => { blank.hidden = !blank.hidden; }, B: () => { blank.hidden = !blank.hidden; },
    '.': () => { blank.hidden = !blank.hidden; },
  };
  const action = actions[e.key];
  if (action) {
    e.preventDefault();
    action();
  }
});

// Click on the left third goes back, anywhere else forward.
img.addEventListener('click', (e) => go(e.clientX < window.innerWidth / 3 ? -1 : 1));
blank.addEventListener('click', () => { blank.hidden = true; });
img.addEventListener('dblclick', (e) => e.preventDefault());

let touchX = null;
document.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
});

$('prev').addEventListener('click', () => go(-1));
$('next').addEventListener('click', () => go(1));
$('prev-pres').addEventListener('click', () => switchPres(-1));
$('next-pres').addEventListener('click', () => switchPres(1));
$('fullscreen').addEventListener('click', toggleFullscreen);
// Keep keyboard control on the slides instead of the last clicked button.
bar.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') e.target.blur(); });

let idleTimer;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!bar.matches(':hover')) document.body.classList.add('idle');
  }, 2500);
}
document.addEventListener('mousemove', wake);
document.addEventListener('touchstart', wake, { passive: true });
wake();
show();
