/* ══════════════════════════════════════════════════════════════
   Tema: automático / claro / escuro + Cinza Chumbo / Solarized Dark / Sépia Suave
   - Preferência salva em localStorage 'sir_mode':
     'auto' | 'light' | 'dark' | 'chumbo' | 'solarized' | 'sepia' | 'campo' | 'cyber' | 'lavanda'
   - Os três temas extras usam uma base (escura ou clara) e trocam as cores
     por cima dela (<html data-skin="…">, cores em css/temas.css)
   - 'auto' segue o tema do celular ou do computador e muda junto com ele
   - Carregado no <head> (antes de desenhar a página) para não piscar
   - Independente das cores de destaque (data-theme), que continuam valendo
   ══════════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'sir_mode';
  var ORDER = ['auto', 'light', 'dark', 'chumbo', 'solarized', 'sepia', 'campo', 'cyber', 'lavanda'];
  var LABEL = { auto: 'Automático', light: 'Claro', dark: 'Escuro', chumbo: 'Cinza Chumbo', solarized: 'Solarized Dark', sepia: 'Sépia Suave', campo: 'Eco-Militar', cyber: 'Cyberpunk Digital', lavanda: 'Lavanda e Areia' };
  var ICON  = { auto: 'sun-moon', light: 'sun', dark: 'moon', chumbo: 'moon-star', solarized: 'waves', sepia: 'book-open', campo: 'trees', cyber: 'zap', lavanda: 'flower-2' };
  /* Temas extras: base (claro/escuro) e cor da barra do navegador */
  var SKIN  = { chumbo: ['dark', '#121212'], solarized: ['dark', '#002B36'], sepia: ['light', '#FDF6E3'], campo: ['dark', '#1F1A14'], cyber: ['dark', '#0D0F12'], lavanda: ['light', '#F6F1E9'] };
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function getPref() {
    try { var v = localStorage.getItem(KEY); return ORDER.indexOf(v) > -1 ? v : 'auto'; }
    catch (e) { return 'auto'; }
  }
  function resolve(pref) {
    if (pref === 'auto') return (mq && mq.matches) ? 'light' : 'dark';
    return SKIN[pref] ? SKIN[pref][0] : pref;
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
    if (SKIN[pref]) root.setAttribute('data-skin', pref); else root.removeAttribute('data-skin');
    root.style.colorScheme = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', SKIN[pref] ? SKIN[pref][1] : (mode === 'light' ? '#f3f4f6' : '#06101d'));
    updateButton();
  }

  window.getThemeModePref = getPref;
  window.cycleThemeMode = function () {
    var i = ORDER.indexOf(getPref());
    var next = ORDER[(i + 1) % ORDER.length];
    try { localStorage.setItem(KEY, next); } catch (e) {}
    apply();
    if (typeof window.showActionToast === 'function')
      window.showActionToast('Tema ' + (ORDER.indexOf(next) + 1) + ' de ' + ORDER.length + ': ' + LABEL[next] + (next === 'auto' ? ' — segue o aparelho' : ''), 'success');
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
