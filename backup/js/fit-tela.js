/* ══════════════════════════════════════════════════════════════
   v66 — Página inteira na tela do computador
   - No computador (tela com 1101px ou mais de largura), com tudo
     recolhido, o painel se ajusta à altura da janela: os totais
     ficam numa linha só, cada grupo de CFs numa linha e, se ainda
     faltar espaço, o painel é reduzido até caber (sem rolagem).
   - Ao expandir qualquer card (CF, "Minhas áreas", gráfico do grupo,
     Linha do Tempo ou módulo fixado), o ajuste sai e a página cresce
     normalmente, com rolagem. Ao recolher tudo, volta a caber.
   - Celular e tablet não mudam.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const MQ = window.matchMedia ? matchMedia('(min-width: 1101px)') : null;
  const MIN_ZOOM = 0.6;
  let raf = 0, applying = false;

  function hasExpanded() {
    const grid = document.getElementById('main-grid');
    if (!grid) return true;
    if (grid.querySelector('.v2-open')) return true;                              /* card de CF / Minhas áreas aberto */
    const fhd = document.documentElement.classList.contains('rec-fhd') && window.innerWidth >= 1600;   /* v83: no Full HD os gráficos de grupo ficam escondidos */
    if (!fhd && grid.querySelector('.v2-reg-charts:not([hidden])')) return true;          /* gráfico de grupo aberto */
    if (grid.querySelector('.v2-timeline:not(.tl-closed)')) return true;          /* Linha do Tempo aberta */
    const pin = document.getElementById('pinned-modules-area');
    if (pin && pin.children.length) return true;                                  /* módulo fixado na tela */
    return false;
  }

  function apply() {
    raf = 0;
    const body = document.body, col = document.querySelector('.v2-dash-col');
    if (!body || !col) return;
    const fit = !!(MQ && MQ.matches) && body.classList.contains('layout-v2') && !hasExpanded();
    applying = true;
    body.classList.toggle('fit-tela', fit);
    col.style.zoom = '';
    if (fit) {
      /* espaço livre = do topo do painel até a margem de baixo da página
         (essa margem já reserva o rodapé fixo) */
      const r = col.getBoundingClientRect();
      const shell = document.querySelector('.page-shell');
      const padB = shell ? parseFloat(getComputedStyle(shell).paddingBottom) || 0 : 0;
      const avail = window.innerHeight - (r.top + window.scrollY) - padB - 2;
      if (r.height > avail && avail > 0) col.style.zoom = Math.max(MIN_ZOOM, avail / r.height).toFixed(3);
    }
    applying = false;
  }
  function schedule() { if (!applying && !raf) raf = requestAnimationFrame(apply); }
  window.sirFitTela = schedule;

  function start() {
    const grid = document.getElementById('main-grid'), pin = document.getElementById('pinned-modules-area');
    const mo = new MutationObserver(schedule);
    const opts = { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] };
    if (grid) mo.observe(grid, opts);
    if (pin) mo.observe(pin, { childList: true });
    new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', schedule);
    if (MQ && MQ.addEventListener) MQ.addEventListener('change', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
