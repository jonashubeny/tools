'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, sampleKind, KIND, createDetector } = require('../src/detector.js');
const fx = require('./fixtures.js');

/** Projede sekvenci jedním detektorem a vrátí verdikty. */
function run(samples, options, state = null) {
  const verdicts = [];
  let st = state;
  for (const s of samples) {
    const r = classify(s, st, options);
    verdicts.push(r);
    st = r.state;
  }
  return { verdicts, devices: verdicts.map((v) => v.device), state: st };
}

/** Posune časy sekvence tak, aby začala `gap` ms po zadaném čase. */
function after(samples, lastT, gap) {
  const shift = lastT + gap - samples[0].t;
  return samples.map((s) => ({ ...s, t: s.t + shift }));
}

const lastT = (samples) => samples[samples.length - 1].t;

test('sampleKind: jednotlivé druhy událostí', () => {
  const base = { deltaX: 0, deltaMode: 0, wheelDeltaX: 0 };
  assert.equal(sampleKind({ ...base, deltaY: 120, wheelDeltaY: -120 }, 15), KIND.NOTCH);
  assert.equal(sampleKind({ ...base, deltaY: 15, wheelDeltaY: -15 }, 15), KIND.HIRES);
  assert.equal(sampleKind({ ...base, deltaY: 15, wheelDeltaY: -15 }, 0), KIND.IRREGULAR);
  assert.equal(sampleKind({ ...base, deltaY: 4.25, wheelDeltaY: -4 }, 15), KIND.IRREGULAR);
  assert.equal(sampleKind({ ...base, deltaY: 0.4, wheelDeltaY: -0 }, 15), KIND.TINY);
  assert.equal(sampleKind({ ...base, deltaY: 0, wheelDeltaY: 0 }, 15), KIND.EMPTY);
  assert.equal(
    sampleKind({ deltaMode: 0, deltaY: 4, wheelDeltaY: -4, deltaX: 1, wheelDeltaX: -1 }, 15),
    KIND.TWO_AXIS,
  );
  assert.equal(sampleKind({ ...base, deltaMode: 1, deltaY: 3, wheelDeltaY: -120 }, 15), KIND.LINE);
  assert.equal(sampleKind({ deltaMode: 0, deltaY: 5, deltaX: 0 }, 15), KIND.UNKNOWN);
  // Vodorovné kolečko (Shift+kolečko nebo náklon) je pořád myš.
  assert.equal(
    sampleKind({ deltaMode: 0, deltaY: 0, wheelDeltaY: 0, deltaX: 120, wheelDeltaX: -120 }, 15),
    KIND.NOTCH,
  );
});

test('klasické kolečko je celé myš', () => {
  const { devices, verdicts } = run(fx.mouseClassic);
  assert.deepEqual(devices, ['mouse', 'mouse', 'mouse', 'mouse', 'mouse']);
  assert.equal(verdicts[4].newStream, true, 'pauza 400 ms začíná nový proud');
});

test('kolečko při zoomu stránky (zlomkové deltaY) je myš', () => {
  assert.ok(run(fx.mouseZoomed).devices.every((d) => d === 'mouse'));
});

test('high-res kolečko je myš', () => {
  assert.ok(run(fx.mouseHighRes).devices.every((d) => d === 'mouse'));
});

test('high-res kolečko s quantum=0 by se bralo jako touchpad', () => {
  // Dokumentuje, k čemu nastavení slouží: 0 jen pro lidi bez high-res myši.
  assert.equal(run(fx.mouseHighRes, { highResQuantum: 0 }).devices[0], 'touchpad');
});

test('touchpad je touchpad od první události včetně dojezdu', () => {
  const { devices, verdicts } = run(fx.touchpadSwipe);
  assert.ok(devices.every((d) => d === 'touchpad'), devices.join(','));
  assert.equal(verdicts[0].newStream, true);
  assert.ok(verdicts.slice(1).every((v) => !v.newStream), 'dojezd patří do stejného proudu');
});

test('touchpad s pravidelnou první hodnotou: přepne se po hlasování', () => {
  const { devices } = run(fx.touchpadUnluckyStart);
  assert.equal(devices[0], 'mouse', 'bez historie se 30 bere jako high-res myš');
  assert.equal(devices[1], 'mouse', 'jeden hlas nestačí');
  assert.ok(devices.slice(2).every((d) => d === 'touchpad'), devices.join(','));
});

test('touchpad s pravidelnou první hodnotou hned po jiném gestu touchpadu', () => {
  const first = run(fx.touchpadSwipe);
  const second = after(fx.touchpadUnluckyStart, lastT(fx.touchpadSwipe), 800);
  const { devices, verdicts } = run(second, undefined, first.state);
  assert.equal(verdicts[0].newStream, true);
  assert.ok(devices.every((d) => d === 'touchpad'), devices.join(','));
});

test('high-res myš hned po touchpadu: krátký omyl se do dvou událostí opraví', () => {
  const first = run(fx.touchpadSwipe);
  const second = after(fx.mouseHighRes, lastT(fx.touchpadSwipe), 1500);
  const { devices } = run(second, undefined, first.state);
  assert.equal(devices[0], 'touchpad', 'paměť odhadne touchpad');
  assert.ok(devices.slice(1).every((d) => d === 'mouse'), devices.join(','));
});

test('high-res myš dlouho po touchpadu je myš hned', () => {
  const first = run(fx.touchpadSwipe);
  const second = after(fx.mouseHighRes, lastT(fx.touchpadSwipe), 10000);
  assert.ok(run(second, undefined, first.state).devices.every((d) => d === 'mouse'));
});

test('klasické kolečko hned po touchpadu je myš hned', () => {
  const first = run(fx.touchpadSwipe);
  const second = after(fx.mouseClassic, lastT(fx.touchpadSwipe), 300);
  assert.ok(run(second, undefined, first.state).devices.every((d) => d === 'mouse'));
});

test('touchpad hned po myši je touchpad hned', () => {
  const first = run(fx.mouseClassic);
  const second = after(fx.touchpadSwipe, lastT(fx.mouseClassic), 300);
  assert.ok(run(second, undefined, first.state).devices.every((d) => d === 'touchpad'));
});

test('silný touchpad zůstává touchpadem i přes náhodné pravidelné hodnoty', () => {
  const samples = fx.seq(1000, [
    [0, 4.25, -4],
    [12, 15, -15],
    [12, 30, -30],
    [12, 120, -120],
    [12, 7.5, -8],
  ]);
  assert.ok(run(samples).devices.every((d) => d === 'touchpad'));
});

test('deltaMode řádků je vždy myš', () => {
  assert.ok(run(fx.mouseLines).devices.every((d) => d === 'mouse'));
});

test('mezera delší než streamGapMs začíná nový proud', () => {
  const samples = fx.seq(1000, [[0, 4, -4], [150, 4, -4], [250, 4, -4]]);
  const { verdicts } = run(samples, { streamGapMs: 200 });
  assert.deepEqual(verdicts.map((v) => v.newStream), [true, false, true]);
});

test('čas jdoucí pozpátku začíná nový proud a nespadne', () => {
  const samples = fx.seq(1000, [[0, 4, -4], [-50, 120, -120]]);
  const { verdicts } = run(samples);
  assert.equal(verdicts[1].newStream, true);
  assert.equal(verdicts[1].device, 'mouse');
});

test('classify nemutuje vstupní stav ani vzorek', () => {
  const s0 = run(fx.touchpadSwipe.slice(0, 3)).state;
  const snapshot = JSON.stringify(s0);
  const sample = { ...fx.touchpadSwipe[3] };
  const sampleSnapshot = JSON.stringify(sample);
  classify(sample, s0);
  assert.equal(JSON.stringify(s0), snapshot);
  assert.equal(JSON.stringify(sample), sampleSnapshot);
});

test('okno drží nejvýš windowSize událostí', () => {
  const { state } = run(fx.touchpadSwipe, { windowSize: 4 });
  assert.equal(state.window.length, 4);
});

test('createDetector dává stejné výsledky jako classify a umí reset', () => {
  const d = createDetector();
  const devices = fx.touchpadUnluckyStart.map((s) => d.classify(s).device);
  assert.deepEqual(devices, run(fx.touchpadUnluckyStart).devices);
  d.reset();
  assert.equal(d.classify(fx.touchpadUnluckyStart[1]).newStream, true);
});

test('fromLog převede výpis z debug režimu na vzorky', () => {
  const log = [
    '[touchpad-scroll] touchpad (irregular) deltaY=4.25 wheelDeltaY=-4 deltaX=0 wheelDeltaX=0 deltaMode=0 dt=-ms NOVÝ-PROUD → zpomaleno',
    'nějaký jiný řádek',
    '[touchpad-scroll] touchpad (proud) deltaY=7.50 wheelDeltaY=-8 deltaX=0.50 wheelDeltaX=-1 deltaMode=0 dt=12ms → zpomaleno',
  ].join('\n');
  const samples = fx.fromLog(log);
  assert.equal(samples.length, 2);
  assert.deepEqual(samples[1], {
    t: 12, deltaY: 7.5, wheelDeltaY: -8, deltaX: 0.5, wheelDeltaX: -1, deltaMode: 0,
  });
  assert.ok(run(samples).devices.every((d) => d === 'touchpad'));
});
