/*
 * Popup a stránka s nastavením (stejný soubor). Každá změna se hned uloží
 * do chrome.storage.sync; content scripty na ni reagují přes onChanged.
 */
'use strict';

const { DEFAULT_SETTINGS, normalizeSettings, parseDomainList, isHostExcluded } =
  globalThis.TouchpadScrollShared;

const $ = (id) => document.getElementById(id);
const ADVANCED = ['highResQuantum', 'streamGapMs', 'memoryMs'];

let settings = { ...DEFAULT_SETTINGS };
let siteHost = null; // hostitel aktivní karty, pokud jde o běžnou webovou stránku

function flash(text) {
  $('status').textContent = text;
  clearTimeout(flash.timer);
  flash.timer = setTimeout(() => ($('status').textContent = ''), 1500);
}

function save(patch) {
  settings = normalizeSettings({ ...settings, ...patch });
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) flash('Chyba: ' + chrome.runtime.lastError.message);
    else flash('Uloženo');
  });
  render();
}

function render() {
  $('enabled').checked = settings.enabled;
  $('factor').value = settings.factor;
  $('factorOut').textContent = settings.factor.toFixed(2) + '×';
  $('debug').checked = settings.debug;
  if (document.activeElement !== $('domains')) {
    $('domains').value = settings.excludedDomains.join('\n');
  }
  for (const key of ADVANCED) {
    if (document.activeElement !== $(key)) $(key).value = settings[key];
  }
  if (siteHost) {
    $('siteBlock').hidden = false;
    $('toggleSite').textContent = isHostExcluded(siteHost, settings.excludedDomains)
      ? `Znovu zapnout na ${siteHost}`
      : `Vypnout na ${siteHost}`;
  }
}

// ---- vazby ovládacích prvků ----------------------------------------------

$('enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
$('debug').addEventListener('change', (e) => save({ debug: e.target.checked }));

// Popisek se mění při tažení, ukládá se až po puštění (šetří kvótu storage.sync).
$('factor').addEventListener('input', (e) => {
  $('factorOut').textContent = Number(e.target.value).toFixed(2) + '×';
});
$('factor').addEventListener('change', (e) => save({ factor: Number(e.target.value) }));

$('domains').addEventListener('change', (e) => {
  save({ excludedDomains: parseDomainList(e.target.value) });
});

for (const key of ADVANCED) {
  $(key).addEventListener('change', (e) => save({ [key]: Number(e.target.value) }));
}
$('resetAdvanced').addEventListener('click', () => {
  const patch = {};
  for (const key of ADVANCED) patch[key] = DEFAULT_SETTINGS[key];
  save(patch);
});

$('toggleSite').addEventListener('click', () => {
  const list = settings.excludedDomains;
  if (isHostExcluded(siteHost, list)) {
    // Odebrat každé pravidlo, které tenhle web pokrývá (i nadřazenou doménu).
    save({ excludedDomains: list.filter((d) => !isHostExcluded(siteHost, [d])) });
  } else {
    save({ excludedDomains: [...list, siteHost] });
  }
});

// ---- start ---------------------------------------------------------------

// V kartě (stránka s nastavením) vrátí getCurrent kartu, v popupu nic.
chrome.tabs.getCurrent((tab) => {
  if (tab) document.body.classList.add('options');
});

chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
  settings = normalizeSettings(stored);
  render();
});

// URL aktivní karty je k dispozici díky oprávnění activeTab po kliknutí na ikonu.
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs && tabs[0] && tabs[0].url;
  if (!url) return;
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      siteHost = u.hostname.replace(/^www\./, '');
      render();
    }
  } catch {
    // interní stránky prohlížeče apod.
  }
});
