/*
 * Rozpoznání touchpad vs. myš z řady wheel událostí.
 *
 * Čistá logika bez DOM a bez globálního stavu: classify() dostane jednu
 * událost a předchozí stav a vrátí verdikt a nový stav. Díky tomu jde celé
 * testovat v Node (`node --test`) a v rozšíření se jen obalí createDetector().
 *
 * Z čeho heuristika vychází (Chromium/Brave na Linuxu):
 *  - `wheelDeltaY` (zastaralá, ale v Chromiu pořád přítomná vlastnost) počítá
 *    Chromium z "tiků" kolečka × 120. Klasické kolečko proto dává násobky 120,
 *    a to i při zoomu stránky (na rozdíl od `deltaY`, které se zoomem škáluje).
 *  - Myš s high-res kolečkem (Logitech MX apod.) dává zlomky tiku, typicky
 *    násobky 120/8 = 15 (nebo 30, 60). Hodnoty jsou pravidelné a jen v jedné ose.
 *  - Touchpad dává libovolná malá čísla, často obě osy najednou, a na konci
 *    kinetického dojezdu i úplné drobky, kdy se wheelDelta zaokrouhlí na 0.
 *
 * Proč se o touchpadu rozhoduje hned na první události proudu:
 *  Chromium nechá zrušitelnou (cancelable) jen první wheel událost scroll
 *  sekvence. Když ji nikdo nezruší přes preventDefault(), zbytek gesta už
 *  posílá jako necancelable a rozšíření ho nemůže zpomalit. Okno posledních
 *  událostí proto slouží hlavně k opravě omylu v rámci proudu a paměť napříč
 *  proudy k rozhodnutí nejednoznačných prvních událostí.
 */
(function (root) {
  'use strict';

  const DETECTOR_DEFAULTS = Object.freeze({
    // Mezera mezi událostmi (ms), po které začíná nový proud (nové gesto).
    streamGapMs: 200,
    // Krok high-res kolečka ve wheelDelta jednotkách; 0 = nemám high-res myš,
    // pak je vše, co není násobek 120, touchpad.
    highResQuantum: 15,
    // Kolik posledních událostí proudu se bere v úvahu při hlasování.
    windowSize: 6,
    // Kolik "touchpadových" událostí v okně přepne proud začatý jako myš.
    minTouchpadVotes: 2,
    // Kolik pravidelných (myších) událostí po sobě vrátí slabě odhadnutý
    // touchpad zpět na myš.
    minMouseVotes: 2,
    // Jak dlouho (ms) po poslední události si pamatovat zařízení jako odhad
    // pro nejednoznačný začátek dalšího proudu.
    memoryMs: 5000,
  });

  // Druh jedné události, nezávisle na historii.
  const KIND = Object.freeze({
    LINE: 'line', //           deltaMode řádky/stránky: jen kolečko
    NOTCH: 'notch', //         násobek 120: klasické kolečko
    HIRES: 'hires', //         násobek highResQuantum: high-res kolečko, nebo náhoda
    TWO_AXIS: 'two-axis', //   obě osy zároveň: kolečko to neumí
    IRREGULAR: 'irregular', // nepravidelná hodnota: touchpad
    TINY: 'tiny', //           deltaY ≠ 0, ale wheelDelta zaokrouhlená na 0: drobek z touchpadu
    EMPTY: 'empty', //         nulová událost
    UNKNOWN: 'unknown', //     prohlížeč nedává wheelDelta
  });

  const TOUCHPAD_KINDS = new Set([KIND.TWO_AXIS, KIND.IRREGULAR, KIND.TINY]);
  const MOUSE_KINDS = new Set([KIND.LINE, KIND.NOTCH]);
  const REGULAR_KINDS = new Set([KIND.LINE, KIND.NOTCH, KIND.HIRES]);

  /**
   * @param {{deltaX:number, deltaY:number, deltaMode:number,
   *          wheelDeltaX?:number, wheelDeltaY?:number}} s
   * @param {number} quantum krok high-res kolečka (0 = vypnuto)
   * @returns {string} jedna z hodnot KIND
   */
  function sampleKind(s, quantum) {
    if (s.deltaMode !== 0) return KIND.LINE;
    const wx = s.wheelDeltaX;
    const wy = s.wheelDeltaY;
    if (typeof wx !== 'number' || typeof wy !== 'number') return KIND.UNKNOWN;
    if (wx === 0 && wy === 0) {
      return s.deltaX || s.deltaY ? KIND.TINY : KIND.EMPTY;
    }
    if (wx !== 0 && wy !== 0) return KIND.TWO_AXIS;
    const v = Math.abs(wx || wy);
    if (v % 120 === 0) return KIND.NOTCH;
    if (quantum > 0 && v % quantum === 0) return KIND.HIRES;
    return KIND.IRREGULAR;
  }

  function initialState() {
    return {
      lastTime: null, //       čas poslední události
      lastDevice: null, //     verdikt poslední události
      streamDevice: null, //   verdikt aktuálního proudu
      streamStrength: null, // 'strong' = podložený daty, 'weak' = jen z paměti
      window: [], //           druhy posledních událostí proudu
    };
  }

  function countFromEnd(list, predicate) {
    let n = 0;
    for (let i = list.length - 1; i >= 0 && predicate(list[i]); i--) n++;
    return n;
  }

  /**
   * Zařadí jednu událost. Nemutuje vstupy.
   *
   * @param {object} sample {t, deltaX, deltaY, deltaMode, wheelDeltaX, wheelDeltaY}
   *                        t = čas v ms (event.timeStamp)
   * @param {object|null} prev stav z předchozího volání (null = začátek)
   * @param {object} [options] přepíše DETECTOR_DEFAULTS
   * @returns {{device:'mouse'|'touchpad', reason:string, kind:string,
   *            newStream:boolean, state:object}}
   */
  function classify(sample, prev, options) {
    const o = Object.assign({}, DETECTOR_DEFAULTS, options);
    const st = prev || initialState();
    const kind = sampleKind(sample, o.highResQuantum);

    const dt = st.lastTime == null ? Infinity : sample.t - st.lastTime;
    const newStream = !(dt >= 0 && dt <= o.streamGapMs);
    const win = (newStream ? [] : st.window).concat(kind).slice(-o.windowSize);

    let device;
    let strength;
    let reason;

    if (newStream) {
      if (MOUSE_KINDS.has(kind)) {
        [device, strength, reason] = ['mouse', 'strong', kind];
      } else if (TOUCHPAD_KINDS.has(kind)) {
        [device, strength, reason] = ['touchpad', 'strong', kind];
      } else {
        // HIRES / UNKNOWN / EMPTY: sama událost nestačí, rozhodne paměť.
        const recentTouchpad =
          st.lastDevice === 'touchpad' && dt <= o.memoryMs;
        [device, strength, reason] = recentTouchpad
          ? ['touchpad', 'weak', kind + ', nedávno touchpad']
          : ['mouse', 'weak', kind];
      }
    } else if (st.streamDevice === 'touchpad') {
      // Touchpad zůstává touchpadem po celý proud, včetně dojezdu, kdy může
      // náhodou padnout i "pravidelná" hodnota. Výjimka: touchpad odhadnutý
      // jen z paměti, po kterém přijde několik pravidelných událostí za sebou;
      // to je ve skutečnosti high-res myš.
      const regularRun = countFromEnd(win, (k) => REGULAR_KINDS.has(k));
      if (st.streamStrength === 'weak' && regularRun >= o.minMouseVotes) {
        [device, strength, reason] = ['mouse', 'strong', `${regularRun}× pravidelně`];
      } else {
        const upgraded = st.streamStrength === 'strong' || TOUCHPAD_KINDS.has(kind);
        [device, strength, reason] = ['touchpad', upgraded ? 'strong' : 'weak', 'proud'];
      }
    } else {
      // Proud začal jako myš. Přepnout jen při opakovaných důkazech.
      const votes = win.filter((k) => TOUCHPAD_KINDS.has(k)).length;
      if (votes >= o.minTouchpadVotes) {
        [device, strength, reason] = ['touchpad', 'strong', `hlasy ${votes}/${win.length}`];
      } else {
        [device, strength, reason] = ['mouse', st.streamStrength, 'proud'];
      }
    }

    return {
      device,
      reason,
      kind,
      newStream,
      state: {
        lastTime: sample.t,
        lastDevice: device,
        streamDevice: device,
        streamStrength: strength,
        window: win,
      },
    };
  }

  /** Stavová obálka pro content script. */
  function createDetector(options) {
    let state = null;
    let opts = Object.assign({}, options);
    return {
      classify(sample) {
        const r = classify(sample, state, opts);
        state = r.state;
        return r;
      },
      setOptions(next) {
        opts = Object.assign({}, next);
      },
      reset() {
        state = null;
      },
    };
  }

  const api = { DETECTOR_DEFAULTS, KIND, sampleKind, classify, createDetector, initialState };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.TouchpadScrollDetector = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
