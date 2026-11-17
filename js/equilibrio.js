/* ══════════════════════════════════════════════════════════════
   v46 — Cards do painel em linhas equilibradas
   Em vez de encher a linha e deixar um card sozinho embaixo
   (ex.: 5 + 1), divide por igual conforme a largura da tela:
     6 áreas → 3 + 3      5 totais → 2 + 3      4 áreas → 4 (ou 2 + 2)
   Vale para celular, tablet e computador e refaz a conta sempre
   que a tela muda de tamanho ou um card é aberto/fechado.
   Só mexe na posição dos cards: nenhum dado é alterado.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const lcm = (a, b) => (a * b) / gcd(a, b);

  /* Divide m cards em linhas iguais de até c cards (a linha menor fica em cima ou embaixo) */
  function evenRows(list, c, shortFirst) {
    const m = list.length;
    if (!m) return [];
    const rows = Math.ceil(m / c), k = Math.ceil(m / rows), rem = m - (rows - 1) * k;
    const out = []; let i = 0;
    for (let r = 0; r < rows; r++) {
      const size = (shortFirst ? r === 0 : r === rows - 1) ? rem : k;
      out.push(list.slice(i, i + size).map(el => ({ el, w: 1 }))); i += size;
    }
    return out;
  }

  /* box: grade · minW: largura mínima do card · maxW: largura máxima quando
     sobra espaço · shortFirst: a linha menor fica em cima · openSpan: colunas
     que um card aberto ocupa */
  function balance(box, minW, maxW, shortFirst, openSpan) {
    const items = Array.from(box.children).filter(el => el.offsetParent !== null);
    const n = items.length;
    if (!n) return;
    const gap = parseFloat(getComputedStyle(box).columnGap) || 8;
    const W = box.parentElement.clientWidth;
    if (!W) return;

    const fit = Math.max(1, Math.floor((W + gap) / (minW + gap)));
    const c   = Math.min(n, fit);
    const isOpen  = el => el.classList.contains('v2-open');
    const anyOpen = items.some(isOpen);
    const ow = Math.min(c, openSpan);                 /* largura do card aberto, em colunas */

    let rows = [];
    if (!anyOpen) {
      rows = evenRows(items, c, shortFirst);
    } else if (ow === c) {
      /* Card aberto ocupa a linha inteira; os fechados antes/depois dele se dividem por igual */
      let seg = [];
      const flush = () => { rows.push(...evenRows(seg, c, false)); seg = []; };
      items.forEach(el => { if (isOpen(el)) { flush(); rows.push([{ el, w: c }]); } else seg.push(el); });
      flush();
    } else {
      /* Tela larga: o card aberto divide a linha com os vizinhos */
      const total = items.reduce((s, el) => s + (isOpen(el) ? ow : 1), 0);
      const cap = Math.max(ow, Math.ceil(total / Math.ceil(total / c)));   /* linhas com o mesmo peso */
      let row = [], t = 0;
      items.forEach(el => {
        const w = isOpen(el) ? ow : 1;
        if (t + w > cap) { rows.push(row); row = []; t = 0; }
        row.push({ el, w }); t += w;
      });
      if (row.length) rows.push(row);
    }

    /* Cada linha ocupa a largura toda; linha com poucos cards (menos da metade) mantém o tamanho normal */
    const tot = r => r.reduce((s, x) => s + x.w, 0);
    const base = r => { const t = tot(r); return (anyOpen && t * 2 < c) ? c : t; };
    const L = rows.reduce((l, r) => lcm(l, base(r)), 1);
    const tplCss = `repeat(${L}, minmax(0, 1fr))`;
    if (box.style.gridTemplateColumns !== tplCss) box.style.gridTemplateColumns = tplCss;
    rows.forEach(r => {
      const unit = L / base(r);
      r.forEach((x, i) => {
        const v = (i === 0 ? '1 / ' : '') + `span ${x.w * unit}`;   /* 1º card de cada linha começa na coluna 1 */
        if (x.el.style.gridColumn !== v) x.el.style.gridColumn = v;
      });
    });
    /* Só 1 ou 2 cards numa tela larga: não esticam além do confortável */
    const mw = (n <= 2 && n < fit && !anyOpen) ? (n * maxW + (n - 1) * gap) + 'px' : '';
    if (box.style.maxWidth !== mw) box.style.maxWidth = mw;
    box.classList.add('eq-on');
  }

  function run() {
    const grid = document.getElementById('main-grid');
    if (!grid || !document.body.classList.contains('layout-v2')) return;
    const vw = window.innerWidth;
    const phone = vw <= 640;
    const tileOpen = vw <= 640 ? 99 : vw <= 900 ? 2 : 3;
    grid.querySelectorAll('.v2-tiles').forEach(b => balance(b, phone ? 140 : 152, 340, false, tileOpen));
    grid.querySelectorAll('.v2-kpis:not(.v2-kpis-mine)').forEach(b => balance(b, phone ? 150 : 200, 440, true, 2));
  }

  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; run(); }); }

  document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('main-grid');
    if (!grid) return;
    if ('MutationObserver' in window) {
      new MutationObserver(schedule).observe(grid, { childList: true });                                   /* painel redesenhado */
      new MutationObserver(schedule).observe(grid, { attributes: true, attributeFilter: ['class'], subtree: true });   /* card aberto/fechado */
    }
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(grid);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    schedule();
  });
  window.sirBalanceCards = schedule;
})();
