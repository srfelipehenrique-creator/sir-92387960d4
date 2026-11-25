/* ══════════════════════════════════════════════════════════════
   Pressable (v62) — aplica a todos os botões do painel, inclusive os
   que são criados depois (cartões, abas, modais, menus).
   - Marca .is-pressed no instante do toque e tira ao soltar, cancelar
     ou arrastar o dedo para fora (rolar a tela não "aperta" o botão).
   - Tamanho do afundamento proporcional ao botão (grandes afundam menos).
   - Vibração curta no celular (se o aparelho permitir).
   - Teclado: Espaço/Enter mostram o mesmo estado pressionado.
   Não altera o que cada botão faz: só o retorno visual/tátil.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const SELETOR = [
    'button', '[role="button"]', '[role="tab"]', '[role="menuitem"]',
    'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
    'a.btn', 'a[class*="btn"]', '.card', '.v2-cell', '.v2-kpi-btn',
    '[class*="btn-"]', '[class^="btn"]', '[onclick]:not(.modal-overlay):not(input[type="text"]):not(textarea):not([contenteditable])'
  ].join(',');
  const REAIS = 'button, [role="button"], [role="tab"], [role="menuitem"], input[type="button"], input[type="submit"], input[type="reset"], a[href], a[onclick]';
  const IGNORAR = '.modal-overlay, .modal-content, .app-menu-backdrop, tr, td, th, table, section, main, body, input[type="text"], input[type="search"], textarea, select, [contenteditable="true"], .pressable-off';
  const MOVE_LIMITE = 10;   // px: passou disso, é rolagem, não toque

  let atual = null, x0 = 0, y0 = 0;

  function alvo(el) {
    if (!el || !el.closest) return null;
    /* Prefere o botão de verdade (assim, tocar no texto de dentro aperta o botão inteiro) */
    const b = el.closest(REAIS) || el.closest(SELETOR);
    if (!b || b.matches(IGNORAR)) return null;
    if (b.disabled || b.getAttribute('aria-disabled') === 'true') return null;
    return b;
  }
  function preparar(b) {
    if (!b.classList.contains('pressable')) b.classList.add('pressable');
    const r = b.getBoundingClientRect();
    const lado = Math.max(r.width, r.height);
    const esc = lado > 260 ? 0.985 : lado > 140 ? 0.97 : lado > 60 ? 0.955 : 0.92;
    b.style.setProperty('--press-scale', esc);
  }
  function apertar(b) { preparar(b); b.classList.add('is-pressed'); atual = b; }
  function soltar() { if (atual) { atual.classList.remove('is-pressed'); atual = null; } }

  document.addEventListener('pointerdown', e => {
    if (e.button && e.button !== 0) return;
    const b = alvo(e.target); if (!b) return;
    x0 = e.clientX; y0 = e.clientY;
    apertar(b);
    if (e.pointerType === 'touch' && navigator.vibrate) { try { navigator.vibrate(8); } catch (_) {} }
  }, { passive: true, capture: true });

  document.addEventListener('pointermove', e => {
    if (!atual) return;
    if (Math.abs(e.clientX - x0) > MOVE_LIMITE || Math.abs(e.clientY - y0) > MOVE_LIMITE) soltar();
  }, { passive: true, capture: true });

  ['pointerup', 'pointercancel', 'dragstart', 'scroll', 'blur'].forEach(ev =>
    (ev === 'blur' ? window : document).addEventListener(ev, soltar, { passive: true, capture: true }));
  document.addEventListener('pointerleave', e => { if (e.target === atual) soltar(); }, true);
  document.addEventListener('visibilitychange', soltar);

  /* Teclado */
  document.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    const b = alvo(document.activeElement); if (b && !e.repeat) apertar(b);
  }, true);
  document.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') soltar(); }, true);

  /* Marca os botões que já existem e os que forem aparecendo (para o foco por teclado
     e as transições funcionarem desde o primeiro uso) */
  function marcar(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.matches && raiz.matches(SELETOR) && !raiz.matches(IGNORAR)) raiz.classList.add('pressable');
    raiz.querySelectorAll(SELETOR).forEach(b => { if (!b.matches(IGNORAR)) b.classList.add('pressable'); });
  }
  let fila = [];
  const obs = new MutationObserver(muts => {
    const vazia = !fila.length;
    muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) fila.push(n); }));
    if (vazia && fila.length) requestAnimationFrame(() => { const f = fila; fila = []; f.forEach(marcar); });
  });
  function iniciar() { marcar(document.body); obs.observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
