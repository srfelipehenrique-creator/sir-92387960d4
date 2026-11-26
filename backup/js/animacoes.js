/* ══════════════════════════════════════════════════════════════
   Animações sutis (v81)
   1. Entrada do painel: na primeira carga, totais, grupos e cards de
      área aparecem em sequência rápida (uma vez só por abertura).
   2. Número que mudou numa atualização: o valor "desliza" na direção
      da mudança e a célula ganha um brilho curto — laranja quando
      SOBE (mais tickets), verde quando DESCE. Some em ~1,2 s.
   3. Selo "atualizado" do rodapé dá um pulso leve a cada atualização.
   Tudo desliga com "reduzir movimento" do sistema.
   Não muda dados nem layout: só classes CSS temporárias (ajustes.css).
   ══════════════════════════════════════════════════════════════ */
(function () {
  const reduz = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const grid = document.getElementById('main-grid');
  if (!grid) return;

  /* ── 1. Entrada (uma vez) ── */
  let entrou = false;
  function entrada() {
    if (entrou || reduz()) return;
    const itens = grid.querySelectorAll(':scope > .v2-kpis > *, .v2-regions .v2-region-head, .v2-regions [data-v2card]');
    if (!itens.length) return;
    entrou = true;
    itens.forEach((el, i) => {
      el.style.setProperty('--sir-i', Math.min(i, 24));
      el.classList.add('sir-in');
    });
    setTimeout(() => itens.forEach(el => { el.classList.remove('sir-in'); el.style.removeProperty('--sir-i'); }), 1600);
  }

  /* ── 2. Número que mudou ── */
  const NUM = '.animate-num, .v2-cell-val, .v2-region-count';
  const num = t => { const n = parseInt(String(t).replace(/\D+/g, ''), 10); return isNaN(n) ? null : n; };
  function marca(el, sobe) {
    const alvo = el.closest('.v2-cell, .v2-kpi-btn, button') || el;
    el.classList.remove('sir-tick-up', 'sir-tick-down');
    alvo.classList.remove('sir-glow-up', 'sir-glow-down');
    void el.offsetWidth;   /* reinicia a animação se mudar de novo */
    el.classList.add(sobe ? 'sir-tick-up' : 'sir-tick-down');
    alvo.classList.add(sobe ? 'sir-glow-up' : 'sir-glow-down');
    clearTimeout(alvo._sirT);
    alvo._sirT = setTimeout(() => {
      el.classList.remove('sir-tick-up', 'sir-tick-down');
      alvo.classList.remove('sir-glow-up', 'sir-glow-down');
    }, 1300);
  }
  let pronto = false;   /* ignora a contagem inicial (0 → valor) da primeira carga */
  const obs = new MutationObserver(lista => {
    if (!pronto || reduz()) return;
    const vistos = new Set();
    for (const m of lista) {
      if (m.type !== 'characterData') continue;
      const el = m.target.parentElement;
      if (!el || vistos.has(el) || !el.matches(NUM)) continue;
      if (el.closest('.v2-timeline, .v2-chart-body, svg')) continue;   /* gráficos têm animação própria */
      const a = num(m.oldValue), b = num(m.target.nodeValue);
      if (a === null || b === null || a === b) continue;
      vistos.add(el);
      marca(el, b > a);
    }
  });
  obs.observe(grid, { subtree: true, characterData: true, characterDataOldValue: true });

  /* ── 3. Pulso do selo de atualização ── */
  function pulsoAtualizado() {
    if (reduz()) return;
    const dot = document.getElementById('status-dot');
    if (!dot) return;
    dot.classList.remove('sir-ping'); void dot.offsetWidth; dot.classList.add('sir-ping');
    clearTimeout(dot._sirT); dot._sirT = setTimeout(() => dot.classList.remove('sir-ping'), 1000);
  }

  /* Liga nos redesenhos do painel */
  if (typeof renderDashboardV2 === 'function') {
    const _orig = renderDashboardV2;
    renderDashboardV2 = function () {
      const r = _orig.apply(this, arguments);
      try {
        if (!entrou) entrada();
        else setTimeout(pulsoAtualizado, 400);   /* depois que o ponto volta a ficar verde */
        /* a contagem 0 → valor da 1ª carga dura ~700 ms; depois disso, mudança = atualização real */
        if (!pronto) setTimeout(() => { pronto = true; }, 1200);
      } catch (e) { console.warn('animações', e); }
      return r;
    };
  }
})();
