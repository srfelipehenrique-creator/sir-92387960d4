/* ══════════════════════════════════════════════════════════════
   Tema (v94): apenas Escuro (vermelho principal) e Claro suave
   - Preferência salva em localStorage 'sir_mode': 'dark' | 'light'
   - Compatibilidade: valores antigos ('sepia', 'lavanda') viram
     'light'; demais ('auto', 'chumbo', 'cyber', 'noturno'…) viram
     'dark', sem perder o acesso nem quebrar a versão principal.
   - Carregado no <head> (antes de desenhar a página) para não piscar.
   ══════════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'sir_mode';
  var ORDER = ['dark', 'light'];
  var LABEL = { dark: 'Escuro', light: 'Claro suave' };
  var ICON  = { dark: 'moon', light: 'sun' };
  var LIGHT_LEGACY = { light: 1, sepia: 1, lavanda: 1 };

  function normalize(v) {
    return LIGHT_LEGACY[v] ? 'light' : 'dark';
  }
  function getPref() {
    try { return normalize(localStorage.getItem(KEY)); }
    catch (e) { return 'dark'; }
  }

  function updateButton() {
    var btn = document.getElementById('btn-theme-mode');
    if (!btn) return;
    var pref = getPref();
    if (btn.getAttribute('data-icon') !== ICON[pref]) {
      btn.setAttribute('data-icon', ICON[pref]);
      btn.innerHTML = '<i data-lucide="' + ICON[pref] + '"></i>';
      if (window.lucide) window.lucide.createIcons({ nodes: [btn.firstChild] });
    }
    var t = 'Tema: ' + LABEL[pref] + ' — toque para alternar';
    btn.title = t;
    btn.setAttribute('aria-label', t);
  }

  function apply() {
    var mode = getPref();
    var root = document.documentElement;
    root.setAttribute('data-mode', mode);
    root.setAttribute('data-mode-pref', mode);
    root.removeAttribute('data-skin');
    root.style.colorScheme = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#ECE8E1' : '#141414');
    updateButton();
  }

  window.getThemeModePref = getPref;
  window.setThemeMode = function (mode, silent) {
    var next = normalize(mode);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply();
    if (!silent && typeof window.showActionToast === 'function')
      window.showActionToast('Tema: ' + LABEL[next], 'success');
  };
  window.cycleThemeMode = function () {
    var next = getPref() === 'dark' ? 'light' : 'dark';
    window.setThemeMode(next, false);
  };

  /* Outra aba/janela mudou o tema */
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });

  apply();
  document.addEventListener('DOMContentLoaded', updateButton);
  window.addEventListener('load', updateButton);
})();
