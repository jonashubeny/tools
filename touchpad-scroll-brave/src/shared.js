/*
 * Sdílené čisté pomůcky: výchozí nastavení, jeho normalizace, vyjmuté domény
 * a drobná scroll aritmetika. Používá je content script i popup, testy
 * je načítají v Node.
 */
(function (root) {
  'use strict';

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    factor: 0.5, //         násobek rychlosti touchpadu
    excludedDomains: [], // domény, kde rozšíření nic nedělá (včetně subdomén)
    debug: false, //        logování do konzole stránky
    // Pokročilé ladění heuristiky (viz detector.js):
    highResQuantum: 15,
    streamGapMs: 200,
    memoryMs: 5000,
  });

  const FACTOR_MIN = 0.1;
  const FACTOR_MAX = 1.0;

  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  /**
   * Z jednoho řádku (doména, URL, "*.doména") udělá holé jméno hostitele.
   * Vrací '' pro nepoužitelný vstup.
   */
  function normalizeDomain(entry) {
    let s = String(entry).trim().toLowerCase();
    if (!s || s.startsWith('#')) return '';
    s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // schéma
    s = s.split(/[/?#]/)[0]; //                     cesta, dotaz
    s = s.replace(/:\d+$/, ''); //                  port
    s = s.replace(/^\*\./, '').replace(/^\.+/, '').replace(/\.+$/, '');
    return s;
  }

  /** Text s doménami (řádky, čárky, mezery) → seřazené pole bez duplicit. */
  function parseDomainList(text) {
    const parts = Array.isArray(text) ? text : String(text || '').split(/[\s,;]+/);
    const set = new Set(parts.map(normalizeDomain).filter(Boolean));
    return [...set].sort();
  }

  /** `example.com` vyjímá example.com i cokoli.example.com. */
  function isHostExcluded(hostname, domains) {
    const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
    if (!host) return false;
    return domains.some((d) => host === d || host.endsWith('.' + d));
  }

  /** Doplní chybějící klíče a ořízne hodnoty do povolených mezí. */
  function normalizeSettings(raw) {
    const r = raw || {};
    const d = DEFAULT_SETTINGS;
    return {
      enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
      factor: clampNumber(r.factor, FACTOR_MIN, FACTOR_MAX, d.factor),
      excludedDomains: parseDomainList(r.excludedDomains || []),
      debug: typeof r.debug === 'boolean' ? r.debug : d.debug,
      highResQuantum: Math.round(clampNumber(r.highResQuantum, 0, 120, d.highResQuantum)),
      streamGapMs: clampNumber(r.streamGapMs, 30, 2000, d.streamGapMs),
      memoryMs: clampNumber(r.memoryMs, 0, 60000, d.memoryMs),
    };
  }

  /**
   * Má scroller kam jet ve směru delta? Půlpixelová tolerance kvůli
   * zlomkovým scroll pozicím na HiDPI displejích.
   */
  function hasRoom(position, scrollSize, clientSize, delta) {
    if (delta > 0) return position < scrollSize - clientSize - 0.5;
    if (delta < 0) return position > 0.5;
    return false;
  }

  /**
   * Rozdělí požadovaný posun na krok zarovnaný na fyzické pixely a zbytek,
   * který se přičte příště. Bez toho by se při malém faktoru drobné delty
   * ztrácely zaokrouhlením a scroll by "lepil".
   */
  function quantizeStep(total, devicePixelRatio) {
    const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
    // Epsilon kvůli plovoucí čárce: 10 × 0.3 je 2.9999…, ne 3.
    const scaled = total * dpr;
    const step = Math.trunc(scaled + Math.sign(scaled) * 1e-6) / dpr;
    return { step, carry: total - step };
  }

  const api = {
    DEFAULT_SETTINGS,
    FACTOR_MIN,
    FACTOR_MAX,
    normalizeDomain,
    parseDomainList,
    isHostExcluded,
    normalizeSettings,
    hasRoom,
    quantizeStep,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.TouchpadScrollShared = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
