/*
 * Ukázkové sekvence wheel událostí.
 *
 * Nejsou nahrané z reálného hardwaru (vznikly na serveru bez touchpadu),
 * jsou sestavené podle toho, jak Chromium na Linuxu plní deltaY a wheelDeltaY:
 * wheelDelta = tiky kolečka × 120 s opačným znaménkem než deltaY. Až budeš mít
 * výpis z debug režimu ze svého stroje, přidej sem skutečné sekvence (funkce
 * fromLog to umí převést přímo z řádků konzole).
 */
'use strict';

/**
 * Sestaví sekvenci ze zápisu [dt, deltaY, wheelDeltaY, deltaX, wheelDeltaX].
 * dt je odstup od předchozí události v ms.
 */
function seq(startT, rows, deltaMode = 0) {
  let t = startT;
  return rows.map(([dt, deltaY, wheelDeltaY, deltaX = 0, wheelDeltaX = 0]) => {
    t += dt;
    return { t, deltaY, wheelDeltaY, deltaX, wheelDeltaX, deltaMode };
  });
}

/** Touchpad: deltaY plynule, wheelDeltaY = -round(deltaY), občas i osa X. */
function touchpadRows(deltas, dt = 12) {
  return deltas.map(([dy, dx = 0]) => [dt, dy, -Math.round(dy), dx, -Math.round(dx)]);
}

// Klasické kolečko: 120 na jeden tik, pomalé otáčení s pauzami mezi tiky.
const mouseClassic = seq(1000, [
  [0, 120, -120],
  [90, 120, -120],
  [110, 120, -120],
  [95, 240, -240], // rychlé otočení: Chromium slije dva tiky do jedné události
  [400, -120, 120], // po pauze opačný směr (nový proud)
]);

// Kolečko při zoomu stránky 110 % a s menším krokem deltaY: deltaY je
// zlomkové, wheelDeltaY zůstává násobkem 120.
const mouseZoomed = seq(1000, [
  [0, 48.48, -120],
  [80, 48.48, -120],
  [80, 96.97, -240],
]);

// Myš s high-res kolečkem (zlomky tiku po 120/8 = 15): rychlé, pravidelné.
const mouseHighRes = seq(1000, [
  [0, 15, -15],
  [16, 15, -15],
  [16, 30, -30],
  [16, 15, -15],
  [24, 45, -45],
  [16, 15, -15],
]);

// Touchpad: tah dvěma prsty, pak kinetický dojezd (momentum) slábnoucí k nule.
const touchpadSwipe = seq(1000, [
  ...touchpadRows([[1.5], [4.25, 0.5], [7.5], [11.25, -0.75], [13], [12.5]]),
  // dojezd po zvednutí prstů
  ...touchpadRows([[11.7], [10.9], [9.4], [8], [6.6], [5.1], [3.8], [2.6], [1.4], [0.4]], 16),
]);

// Touchpad, jehož první událost má náhodou "pravidelnou" hodnotu 30.
const touchpadUnluckyStart = seq(1000, [
  [0, 30, -30],
  ...touchpadRows([[17.25], [21.5, 1.25], [19], [16.75]]),
]);

// Myš v režimu řádků (typické pro Firefox, v Chromiu nečekané).
const mouseLines = seq(1000, [[0, 3, -120], [100, 3, -120]], 1);

/**
 * Převede řádky z debug výpisu konzole na vzorky, např.:
 *   [touchpad-scroll] touchpad (irregular) deltaY=4.25 wheelDeltaY=-4 deltaX=0 wheelDeltaX=0 deltaMode=0 dt=12ms → ...
 * Pole `dt` u první události ("-") se bere jako 0.
 */
function fromLog(text) {
  let t = 0;
  const out = [];
  for (const line of text.split('\n')) {
    const num = (key) => {
      const m = line.match(new RegExp(`\\b${key}=(-?[\\d.]+)`));
      return m ? Number(m[1]) : null;
    };
    const deltaY = num('deltaY');
    if (deltaY === null) continue;
    t += num('dt') || 0;
    out.push({
      t,
      deltaY,
      wheelDeltaY: num('wheelDeltaY'),
      deltaX: num('deltaX') || 0,
      wheelDeltaX: num('wheelDeltaX') || 0,
      deltaMode: num('deltaMode') || 0,
    });
  }
  return out;
}

module.exports = {
  seq,
  fromLog,
  mouseClassic,
  mouseZoomed,
  mouseHighRes,
  touchpadSwipe,
  touchpadUnluckyStart,
  mouseLines,
};
