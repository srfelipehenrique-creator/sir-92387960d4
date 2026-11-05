/* ══════════════════════════════════════════════════════════════
   Tema claro / escuro / automático
   - Preferência salva em localStorage 'sir_mode': 'auto' | 'light' | 'dark'
   - 'auto' segue o tema do celular ou do computador e muda junto com ele
   - Carregado no <head> (antes de desenhar a página) para não piscar
   - Independente das cores de destaque (data-theme), que continuam valendo
   ══════════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'sir_mode';
  var ORDER = ['auto', 'light', 'dark'];
  var LABEL = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };
  var ICON  = { auto: 'sun-moon', light: 'sun', dark: 'moon' };
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function getPref() {
    try { var v = localStorage.getItem(KEY); return ORDER.indexOf(v) > -1 ? v : 'auto'; }
    catch (e) { return 'auto'; }
  }
  function resolve(pref) {
    if (pref === 'auto') return (mq && mq.matches) ? 'light' : 'dark';
    return pref;
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
    var t = 'Tema: ' + LABEL[pref] + (pref === 'auto' ? ' (segue o aparelho)' : '') + ' — toque para trocar';
    btn.title = t;
    btn.setAttribute('aria-label', t);
  }

  function apply() {
    var pref = getPref(), mode = resolve(pref);
    var root = document.documentElement;
    root.setAttribute('data-mode', mode);
    root.setAttribute('data-mode-pref', pref);
    root.style.colorScheme = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#f3f4f6' : '#141416');
    updateButton();
  }

  window.getThemeModePref = getPref;
  window.cycleThemeMode = function () {
    var next = ORDER[(ORDER.indexOf(getPref()) + 1) % ORDER.length];
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply();
    if (typeof window.showActionToast === 'function')
      window.showActionToast('Tema: ' + LABEL[next] + (next === 'auto' ? ' — segue o aparelho' : ''), 'success');
  };

  if (mq) {
    var onChange = function () { if (getPref() === 'auto') apply(); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  /* Outra aba/janela mudou o tema */
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });

  apply();
  document.addEventListener('DOMContentLoaded', updateButton);
  window.addEventListener('load', updateButton);
})();
