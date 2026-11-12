/* ══════════════════════════════════════════════════════════════
   Gráficos do layout novo (abaixo das regiões)
   - Esquerda: quantidade de RAL por área (CF)
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
  const H = 210, padL = 30, padR = 10, padT = 18, padB = 26;
  const W = Math.max(260, Math.round(width));
  const vals = rows.map(r => r[tk]);
  const max = _niceMax(Math.max(1, ...vals));
  const n = rows.length;
  const iw = W - padL - padR, ih = H - padT - padB;
  const x = i => padL + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = v => padT + ih - (v / max) * ih;
  const col = _v2ChartColor(tk);
  const id = 'g' + tk;

  let g = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity=".38"/><stop offset="100%" stop-color="${col}" stop-opacity=".02"/></linearGradient>
      <filter id="${id}f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  /* linhas de grade + eixo Y */
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k, yy = y(v);
    g += `<line class="g-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke-dasharray="${k ? '3 4' : ''}" opacity="${k ? .55 : .9}"/>`;
    g += `<text class="g-axis" x="${padL - 6}" y="${yy + 3.5}" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  /* rótulos do eixo X (pula alguns se faltar espaço) */
  const every = Math.max(1, Math.ceil(n / Math.floor(iw / 25)));
  rows.forEach((r, i) => {
    if (i % every && i !== n - 1) return;
    g += `<text class="g-x${r.mine ? ' mine' : ''}" x="${x(i)}" y="${H - 8}" text-anchor="middle">${escapeHtml(r.cf)}</text>`;
  });
  if (n) {
    const pts = rows.map((r, i) => [x(i), y(r[tk])]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    g += `<path d="${line} L${pts[n - 1][0].toFixed(1)} ${y(0)} L${pts[0][0].toFixed(1)} ${y(0)} Z" fill="url(#${id})"/>`;
    g += `<path d="${line}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" filter="url(#${id}f)"/>`;
    rows.forEach((r, i) => {
      const [px, py] = pts[i], v = r[tk];
      const label = `${tk.toUpperCase()} ${r.cf}: ${v}`;
      g += `<g data-chart-cf="${escapeHtml(r.cf)}" data-chart-tk="${tk}" role="button" tabindex="0" aria-label="${label}">
        <title>${label} — toque para abrir a lista</title>
        <rect class="g-hit" x="${px - 14}" y="${padT - 8}" width="28" height="${ih + 8}"/>
        <circle class="g-pt" cx="${px}" cy="${py}" r="4" fill="${col}" stroke="var(--bg-panel)" stroke-width="1.5"/>
        ${v ? `<text class="g-val" x="${px}" y="${py - 8}" text-anchor="middle" fill="${col}">${v}</text>` : ''}
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
