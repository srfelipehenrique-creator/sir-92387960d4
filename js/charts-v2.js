/* ══════════════════════════════════════════════════════════════
   Gráficos do layout novo (abaixo das regiões)
   - Esquerda: quantidade de RAL por área (CF) — colunas
   - Direita:  quantidade de REC por área (CF)
   Mostra as mesmas áreas do painel (todas ou só as suas).
   Tocar num ponto abre a lista daquela área.
   Desenho próprio em SVG (sem biblioteca externa → funciona offline).
   ══════════════════════════════════════════════════════════════ */

const V2_CHART_COLORS = { ral: '#3ee6a0', rec: '#f5c518' };
const V2_CHART_COLORS_LIGHT = { ral: '#0f9f6e', rec: '#c99400' };   /* tons mais fortes para fundo claro */
function _v2ChartColor(tk) { return (document.documentElement.getAttribute('data-mode') === 'light' ? V2_CHART_COLORS_LIGHT : V2_CHART_COLORS)[tk]; }
let _v2ChartData = null;

function _v2ChartAreas(ralR, recR) {
  const areas = getUserSavedAreas();
  const scope = areas.length ? getV2Scope() : 'all';
  const out = [];
  for (const [rn, cfs] of Object.entries(REGIONS)) {
    for (const cf of Object.keys(cfs)) {
      if (scope === 'mine' && !areas.includes(cf)) continue;
      out.push({ cf, ral: ralR[rn].items[cf] || 0, rec: recR[rn].items[cf] || 0, mine: areas.includes(cf) && scope === 'all' });
    }
  }
  return out;
}

/* Topo do eixo Y em número "redondo" (4 faixas iguais) */
function _niceMax(v) {
  if (v <= 4) return 4;
  const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = [1, 2, 2.5, 5, 10].find(m => m * p >= raw);
  return m * p * 4;
}

function _v2ChartSVG(tk, rows, width) {
  const W = Math.max(260, Math.round(width));
  /* Pouco espaço por área (celular) → nomes inclinados, todos visíveis */
  const tilt = rows.length && (W - 40) / rows.length < 26;
  const H = 210, padL = 30, padR = 10, padT = 18, padB = tilt ? 36 : 26;
  const vals = rows.map(r => r[tk]);
  const max = _niceMax(Math.max(1, ...vals));
  const n = rows.length;
  const iw = W - padL - padR, ih = H - padT - padB;
  const band = n ? iw / n : iw;                                   /* espaço de cada área */
  const x = i => padL + band * (i + 0.5);                          /* centro da coluna */
  const bw = Math.max(6, Math.min(34, band * 0.62));               /* largura da coluna */
  const y = v => padT + ih - (v / max) * ih;
  const col = _v2ChartColor(tk);
  const id = 'g' + tk;

  let g = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".95"/><stop offset="100%" stop-color="${col}" stop-opacity=".28"/></linearGradient>
      <filter id="${id}f" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  /* linhas de grade + eixo Y */
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k, yy = y(v);
    g += `<line class="g-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke-dasharray="${k ? '3 4' : ''}" opacity="${k ? .55 : .9}"/>`;
    g += `<text class="g-axis" x="${padL - 6}" y="${yy + 3.5}" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  /* rótulos do eixo X: todos; inclinados quando falta espaço */
  rows.forEach((r, i) => {
    const t = escapeHtml(r.cf), cls = `g-x${r.mine ? ' mine' : ''}`;
    g += tilt
      ? `<text class="${cls}" x="${x(i)}" y="${H - padB + 12}" text-anchor="end" transform="rotate(-50 ${x(i)} ${H - padB + 12})" style="font-size:9px">${t}</text>`
      : `<text class="${cls}" x="${x(i)}" y="${H - 8}" text-anchor="middle">${t}</text>`;
  });
  if (n) {
    const y0 = y(0);
    rows.forEach((r, i) => {
      const v = r[tk], cx = x(i), top = y(v), h = Math.max(0, y0 - top);
      const rad = Math.min(4, bw / 2, h);
      const label = `${tk.toUpperCase()} ${r.cf}: ${v}`;
      /* coluna com cantos de cima arredondados */
      const bar = h > 0
        ? `<path class="g-bar" d="M${(cx - bw / 2).toFixed(1)} ${y0} V${(top + rad).toFixed(1)} Q${(cx - bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx - bw / 2 + rad).toFixed(1)} ${top.toFixed(1)} H${(cx + bw / 2 - rad).toFixed(1)} Q${(cx + bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx + bw / 2).toFixed(1)} ${(top + rad).toFixed(1)} V${y0} Z" fill="url(#${id})" stroke="${col}" stroke-width="1" filter="url(#${id}f)"/>`
        : `<line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y0 - 0.5}" y2="${y0 - 0.5}" stroke="${col}" stroke-opacity=".35" stroke-width="2"/>`;
      g += `<g class="g-col" data-chart-cf="${escapeHtml(r.cf)}" data-chart-tk="${tk}" role="button" tabindex="0" aria-label="${label}">
        <title>${label} — toque para abrir a lista</title>
        <rect class="g-hit" x="${(cx - band / 2).toFixed(1)}" y="${padT - 8}" width="${band.toFixed(1)}" height="${ih + 8}"/>
        ${bar}
        ${v ? `<text class="g-val" x="${cx}" y="${top - 6}" text-anchor="middle" fill="${col}">${v}</text>` : ''}
      </g>`;
    });
  }
  return `<svg class="v2-chart-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${tk.toUpperCase()} por área">${g}</svg>`;
}

function renderV2Charts() {
  const box = document.getElementById('v2-charts');
  if (!box || !_v2ChartData) return;
  const rows = _v2ChartData;
  const totRal = rows.reduce((s, r) => s + r.ral, 0), totRec = rows.reduce((s, r) => s + r.rec, 0);
  box.querySelectorAll('.v2-chart').forEach(card => {
    const tk = card.dataset.tk;
    const holder = card.querySelector('.v2-chart-body');
    const w = holder.clientWidth || 400;
    holder.innerHTML = rows.length ? _v2ChartSVG(tk, rows, w) : '<div class="v2-chart-empty">Nenhuma área para mostrar</div>';
    card.querySelector('.v2-chart-sub').textContent = `${tk === 'ral' ? totRal : totRec} no total · ${rows.length} área${rows.length === 1 ? '' : 's'}`;
  });
}

function _v2ChartsShell() {
  return `<section class="v2-charts" id="v2-charts">
    <div class="v2-chart" data-tk="ral"><div class="v2-chart-head"><span class="v2-chart-title">RAL por área</span><span class="v2-chart-sub"></span></div><div class="v2-chart-body"></div></div>
    <div class="v2-chart" data-tk="rec"><div class="v2-chart-head"><span class="v2-chart-title">REC por área</span><span class="v2-chart-sub"></span></div><div class="v2-chart-body"></div></div>
  </section>`;
}

/* Desenha os gráficos sempre que o painel (layout novo) é redesenhado */
if (typeof renderDashboardV2 === 'function') {
  const _rdv2 = renderDashboardV2;
  renderDashboardV2 = function (ralRes, ralR, recRes, recR, userSavedAreas) {
    const r = _rdv2.apply(this, arguments);
    try {
      _v2ChartData = _v2ChartAreas(ralR, recR);
      const grid = document.getElementById('main-grid');
      grid.insertAdjacentHTML('beforeend', _v2ChartsShell());
      renderV2Charts();
    } catch (e) { console.warn('gráficos', e); }
    return r;
  };
}

/* Tocar num ponto → abre a lista daquela área */
function _openChartPoint(el) {
  const cf = el.dataset.chartCf, isRal = el.dataset.chartTk === 'ral';
  openModal(cf, isRal, (typeof _cfTitle === 'function') ? _cfTitle(isRal ? 'ral' : 'rec', cf) : cf);
}
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-chart-cf]'); if (el) _openChartPoint(el); });
document.addEventListener('keydown', e => { if (e.key !== 'Enter') return; const el = e.target.closest && e.target.closest('[data-chart-cf]'); if (el) _openChartPoint(el); });

/* Troca de tema claro/escuro → cores dos gráficos acompanham */
new MutationObserver(() => renderV2Charts()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });

/* Redesenha ao mudar o tamanho da tela (girar o celular, janela dividida etc.) */
let _v2ChartRz = 0;
window.addEventListener('resize', () => { clearTimeout(_v2ChartRz); _v2ChartRz = setTimeout(renderV2Charts, 150); });
