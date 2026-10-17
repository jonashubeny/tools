// Stamp the theme on <html> before anything is painted, so there is no flash.
// 'system' follows the OS; the app re-stamps it when the setting changes.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('lemma.theme');
  } catch (e) {
    stored = null;
  }
  var theme = stored === 'light' || stored === 'dark' ? stored : stored === 'system' ? null : 'dark';
  if (theme === null)
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();
