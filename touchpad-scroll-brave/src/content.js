/*
 * Content script: běží v každém rámci každé stránky.
 *
 * Postup pro každou wheel událost:
 *  1. capture fáze na window: zařadit událost (myš / touchpad), uložit verdikt.
 *  2. bubble fáze na window: pokud jde o touchpad a stránka událost sama
 *     neobsloužila (mapy, canvas, vlastní scrollery volají preventDefault),
 *     zrušit výchozí scroll a odscrollovat ručně o delta × faktor.
 *
 * Akce je až v bubble fázi záměrně: tak se rozšíření automaticky nemíchá do
 * stránek, které wheel zpracovávají samy. V capture fázi by to ještě nevědělo.
 */
(() => {
  'use strict';

  const { createDetector } = globalThis.TouchpadScrollDetector;
  const { DEFAULT_SETTINGS, normalizeSettings, isHostExcluded, hasRoom, quantizeStep } =
    globalThis.TouchpadScrollShared;

  const LOG_PREFIX = '[touchpad-scroll]';

  // Speciální cíle proudu (vedle konkrétního elementu).
  const ROOT = 'root'; //       scroll celého dokumentu (window.scrollBy)
  const NATIVE = 'native'; //   v tomto rámci není co scrollovat → nechat prohlížeči
  const BLOCKED = 'blocked'; // scroller na konci s overscroll-behavior: contain/none

  let settings = { ...DEFAULT_SETTINGS };
  let ready = false; // dokud nejsou načtená nastavení, nic neměníme
  let excludedHere = false;
  const detector = createDetector(settings);

  // ---- nastavení ---------------------------------------------------------

  /** Hostitelé tohoto rámce a všech nadřazených (kvůli vloženým iframům). */
  function hostsOfThisPage() {
    const hosts = [location.hostname];
    const ancestors = location.ancestorOrigins || [];
    for (let i = 0; i < ancestors.length; i++) {
      try {
        hosts.push(new URL(ancestors[i]).hostname);
      } catch {
        // neplatný origin ("null" u sandboxovaných rámců) přeskočit
      }
    }
    return hosts.filter(Boolean);
  }

  function applySettings(raw) {
    settings = normalizeSettings(raw);
    detector.setOptions(settings);
    detector.reset();
    excludedHere = hostsOfThisPage().some((h) => isHostExcluded(h, settings.excludedDomains));
    ready = true;
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, applySettings);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    chrome.storage.sync.get(DEFAULT_SETTINGS, applySettings);
  });

  // ---- hledání scrollovatelného cíle -------------------------------------

  const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

  function axisOf(dx, dy) {
    return Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
  }

  function elementCanScroll(el, style, axis, delta) {
    if (axis === 'y') {
      return (
        SCROLLABLE_OVERFLOW.has(style.overflowY) &&
        hasRoom(el.scrollTop, el.scrollHeight, el.clientHeight, delta)
      );
    }
    return (
      SCROLLABLE_OVERFLOW.has(style.overflowX) &&
      hasRoom(el.scrollLeft, el.scrollWidth, el.clientWidth, delta)
    );
  }

  /** Je element scroll kontejner s obsahem přesahujícím v dané ose? */
  function isScrollContainer(el, style, axis) {
    return axis === 'y'
      ? SCROLLABLE_OVERFLOW.has(style.overflowY) && el.scrollHeight > el.clientHeight
      : SCROLLABLE_OVERFLOW.has(style.overflowX) && el.scrollWidth > el.clientWidth;
  }

  function rootCanScroll(axis, delta) {
    const html = document.documentElement;
    const scroller = document.scrollingElement || html;
    if (!html) return false;
    // Overflow viewportu se bere z <html>, a pokud je tam visible, z <body>.
    const prop = axis === 'y' ? 'overflowY' : 'overflowX';
    let overflow = getComputedStyle(html)[prop];
    if (overflow === 'visible' && document.body) overflow = getComputedStyle(document.body)[prop];
    if (overflow === 'hidden' || overflow === 'clip') return false;
    return axis === 'y'
      ? hasRoom(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight, delta)
      : hasRoom(scroller.scrollLeft, scroller.scrollWidth, scroller.clientWidth, delta);
  }

  /**
   * Nejbližší předek cíle, který umí scrollovat ve směru hlavní osy gesta.
   * Prochází i přes shadow DOM (composedPath). Scroller na konci se přeskočí
   * a pokračuje se k rodiči, jako při nativním řetězení scrollu; zastaví to
   * jen overscroll-behavior: contain/none.
   */
  function findScrollTarget(event, dx, dy) {
    const axis = axisOf(dx, dy);
    const delta = axis === 'y' ? dy : dx;
    const html = document.documentElement;
    const overscrollProp = axis === 'y' ? 'overscrollBehaviorY' : 'overscrollBehaviorX';

    for (const node of event.composedPath()) {
      if (!(node instanceof Element)) continue;
      if (node === html || node === document.body) break; // řeší rootCanScroll
      const style = getComputedStyle(node);
      if (elementCanScroll(node, style, axis, delta)) return node;
      if (isScrollContainer(node, style, axis) && style[overscrollProp] !== 'auto') {
        return BLOCKED;
      }
    }
    return rootCanScroll(axis, delta) ? ROOT : NATIVE;
  }

  // ---- provedení scrollu (dávkově jednou za snímek) ----------------------

  const pending = new Map(); // cíl → {x, y} posunu čekajícího na snímek
  const carries = new Map(); // cíl → {x, y} zbytku pod fyzický pixel
  let frameRequested = false;

  function enqueueScroll(target, dx, dy) {
    const p = pending.get(target) || { x: 0, y: 0 };
    p.x += dx;
    p.y += dy;
    pending.set(target, p);
    if (!frameRequested) {
      frameRequested = true;
      requestAnimationFrame(flushScroll);
    }
  }

  function flushScroll() {
    frameRequested = false;
    const dpr = window.devicePixelRatio || 1;
    for (const [target, p] of pending) {
      const c = carries.get(target) || { x: 0, y: 0 };
      const qx = quantizeStep(p.x + c.x, dpr);
      const qy = quantizeStep(p.y + c.y, dpr);
      carries.set(target, { x: qx.carry, y: qy.carry });
      if (qx.step === 0 && qy.step === 0) continue;
      // behavior 'instant' přebije případné CSS scroll-behavior: smooth,
      // které by každou drobnou deltu animovalo a scroll by se vlekl.
      const opts = { left: qx.step, top: qy.step, behavior: 'instant' };
      if (target === ROOT) window.scrollBy(opts);
      else if (target.isConnected) target.scrollBy(opts);
    }
    pending.clear();
  }

  // ---- debug log ---------------------------------------------------------

  function describeTarget(t) {
    if (typeof t === 'string') return t;
    let s = t.tagName.toLowerCase();
    if (t.id) s += '#' + t.id;
    else if (t.classList.length) s += '.' + [...t.classList].slice(0, 2).join('.');
    return s;
  }

  function fmt(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  }

  /** Vypíše se až po doběhnutí dispatchu, aby bylo známé i výsledné action. */
  function scheduleLog(record) {
    setTimeout(() => {
      const r = record;
      // console.log, ne console.debug: debug úroveň DevTools ve výchozím stavu skrývá.
      console.log(
        `${LOG_PREFIX} ${r.device.padEnd(8)} (${r.reason})` +
          ` deltaY=${fmt(r.deltaY)} wheelDeltaY=${r.wheelDeltaY}` +
          ` deltaX=${fmt(r.deltaX)} wheelDeltaX=${r.wheelDeltaX}` +
          ` deltaMode=${r.deltaMode} dt=${r.dt}ms` +
          `${r.newStream ? ' NOVÝ-PROUD' : ''}${r.cancelable ? '' : ' necancelable'}` +
          ` → ${r.action}`,
      );
    }, 0);
  }

  // ---- obsluha událostí --------------------------------------------------

  let current = null; //  verdikt právě dispatchované události
  let stream = { target: null }; // stav aktuálního proudu (gesta)
  let lastTimeStamp = null;

  function onWheelCapture(e) {
    current = null;
    if (!ready || !settings.enabled || excludedHere) return;
    // Ctrl+wheel = zoom, včetně pinch-to-zoom na touchpadu. Vůbec nesahat
    // a nezapočítávat do detekce.
    if (e.ctrlKey) return;

    const verdict = detector.classify({
      t: e.timeStamp,
      deltaX: e.deltaX,
      deltaY: e.deltaY,
      deltaMode: e.deltaMode,
      wheelDeltaX: e.wheelDeltaX,
      wheelDeltaY: e.wheelDeltaY,
    });
    if (verdict.newStream) stream = { target: null };

    current = { event: e, verdict, record: null };
    if (settings.debug) {
      current.record = {
        device: verdict.device,
        reason: verdict.reason,
        newStream: verdict.newStream,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        wheelDeltaX: e.wheelDeltaX,
        wheelDeltaY: e.wheelDeltaY,
        deltaMode: e.deltaMode,
        cancelable: e.cancelable,
        dt: lastTimeStamp == null ? '-' : Math.round(e.timeStamp - lastTimeStamp),
        // Když bubble fáze vůbec nedoběhne (stránka zavolala
        // stopPropagation), zůstane tu tahle výchozí hodnota.
        action:
          verdict.device === 'touchpad'
            ? 'nativní (stránka zastavila propagaci)'
            : 'nativní (myš)',
      };
      scheduleLog(current.record);
    }
    lastTimeStamp = e.timeStamp;
  }

  function setAction(text) {
    if (current.record) current.record.action = text;
  }

  function onWheelBubble(e) {
    if (!current || current.event !== e) return;
    if (current.verdict.device !== 'touchpad') return;

    if (e.defaultPrevented) return setAction('stránka si scroll řeší sama');
    if (!e.cancelable) return setAction('nativní (prohlížeč nedovolil zrušit)');
    const path = e.composedPath();
    if (path[0] instanceof HTMLCanvasElement) return setAction('nativní (canvas)');

    // Cíl se vybírá jednou na začátku proudu a pak drží (latching), stejně
    // jako nativně: vnitřní scroller dojetý během gesta nepředá zbytek gesta
    // rodiči, rodič se chytí až dalším gestem. Znovu se hledá jen tehdy,
    // když cíl mezitím zmizel z DOM.
    const stale = stream.target instanceof Element && !stream.target.isConnected;
    if (stream.target === null || stale) {
      stream.target = findScrollTarget(e, e.deltaX, e.deltaY);
    }

    if (stream.target === NATIVE) return setAction('nativní (v tomto rámci není co scrollovat)');
    e.preventDefault();
    if (stream.target === BLOCKED) return setAction('zablokováno (overscroll-behavior)');

    const f = settings.factor;
    enqueueScroll(stream.target, e.deltaX * f, e.deltaY * f);
    setAction(`zpomaleno ×${f} → ${describeTarget(stream.target)}`);
  }

  window.addEventListener('wheel', onWheelCapture, { capture: true, passive: true });
  // passive: false je nutné: Chromium jinak bere wheel posluchače na window
  // jako pasivní a preventDefault() by se tiše ignoroval.
  window.addEventListener('wheel', onWheelBubble, { capture: false, passive: false });
})();
