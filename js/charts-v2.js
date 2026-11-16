/* ══════════════════════════════════════════════════════════════
   Gráficos do layout novo (abaixo das regiões)
   - Esquerda: quantidade de RAL por área (CF) — colunas
   - Direita:  quantidade de REC por área (CF)
   Mostra as mesmas áreas do painel (todas ou só as suas).
   Tocar num ponto abre a lista daquela área.
   Desenho próprio em SVG (sem biblioteca externa → funciona offline).
   - Cada coluna segue a mesma regra de cor dos cards, pela quantidade:
     1–5 verde · 6–9 amarelo · 10+ vermelho (a legenda fica em cada gráfico).
   - O botão "Encolher / Expandir" esconde ou mostra os dois gráficos;
     a escolha fica salva neste aparelho ('sir_charts_collapsed').
   ══════════════════════════════════════════════════════════════ */

const LS_CHARTS_COLLAPSED = 'sir_charts_collapsed';
function chartsCollapsed() { try { return localStorage.getItem(LS_CHARTS_COLLAPSED) === '1'; } catch (e) { return false; } }
/* Cor da coluna pela quantidade — mesma regra dos cards (_sev) */
function _v2ChartSev(v) { return v >= 10 ? 'crit' : v >= 6 ? 'warn' : 'ok'; }
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
  const id = 'g' + tk;

  /* Um degradê por faixa de quantidade (verde, amarelo, vermelho) */
  let g = `<defs>${['ok', 'warn', 'crit'].map(sv => `<linearGradient id="${id}${sv}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style="stop-color:var(--v2-${sv})" stop-opacity=".95"/><stop offset="100%" style="stop-color:var(--v2-${sv})" stop-opacity=".28"/></linearGradient>`).join('')}
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
      const sv = _v2ChartSev(v), col = `var(--v2-${sv})`;
      const label = `${tk.toUpperCase()} ${r.cf}: ${v}`;
      /* coluna com cantos de cima arredondados */
      const bar = h > 0
        ? `<path class="g-bar" d="M${(cx - bw / 2).toFixed(1)} ${y0} V${(top + rad).toFixed(1)} Q${(cx - bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx - bw / 2 + rad).toFixed(1)} ${top.toFixed(1)} H${(cx + bw / 2 - rad).toFixed(1)} Q${(cx + bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx + bw / 2).toFixed(1)} ${(top + rad).toFixed(1)} V${y0} Z" fill="url(#${id}${sv})" style="stroke:${col}" stroke-width="1" filter="url(#${id}f)"/>`
        : `<line class="g-zero" x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y0 - 0.5}" y2="${y0 - 0.5}" stroke-width="2"/>`;
      g += `<g class="g-col" data-chart-cf="${escapeHtml(r.cf)}" data-chart-tk="${tk}" role="button" tabindex="0" aria-label="${label}">
        <title>${label} — toque para abrir a lista</title>
        <rect class="g-hit" x="${(cx - band / 2).toFixed(1)}" y="${padT - 8}" width="${band.toFixed(1)}" height="${ih + 8}"/>
        ${bar}
        ${v ? `<text class="g-val" x="${cx}" y="${top - 6}" text-anchor="middle" style="fill:${col}">${v}</text>` : ''}
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
  const sum = document.getElementById('v2-charts-sum');
  if (sum) sum.textContent = `RAL ${totRal} · REC ${totRec} · ${rows.length} área${rows.length === 1 ? '' : 's'}`;
  if (chartsCollapsed()) return;               /* encolhido: nada para desenhar */
  box.querySelectorAll('.v2-chart').forEach(card => {
    const tk = card.dataset.tk;
    const holder = card.querySelector('.v2-chart-body');
    const w = holder.clientWidth || 400;
    holder.innerHTML = rows.length ? _v2ChartSVG(tk, rows, w) : '<div class="v2-chart-empty">Nenhuma área para mostrar</div>';
    card.querySelector('.v2-chart-sub').textContent = `${tk === 'ral' ? totRal : totRec} no total · ${rows.length} área${rows.length === 1 ? '' : 's'}`;
  });
}

function _v2ChartsShell() {
  const c = chartsCollapsed();
  const legend = `<span class="v2-legend v2-chart-legend" aria-label="Cores por quantidade">
      <span><i class="v2-dot v2-dot-ok"></i>1–5</span><span><i class="v2-dot v2-dot-warn"></i>6–9</span><span><i class="v2-dot v2-dot-crit"></i>10+</span></span>`;
  const card = (tk, title) => `<div class="v2-chart" data-tk="${tk}"><div class="v2-chart-head"><span class="v2-chart-title">${title}</span>${legend}<span class="v2-chart-sub"></span></div><div class="v2-chart-body"></div></div>`;
  return `<section class="v2-charts-wrap${c ? ' is-collapsed' : ''}" id="v2-charts-wrap">
    <div class="v2-charts-bar">
      <span class="v2-charts-ttl">Gráficos por área</span>
      <span class="v2-charts-sum" id="v2-charts-sum"></span>
      <button type="button" class="v2-charts-toggle" id="v2-charts-toggle" onclick="toggleV2Charts()" aria-expanded="${!c}" aria-controls="v2-charts">${_v2ChartsToggleLabel(c)}</button>
    </div>
    <section class="v2-charts" id="v2-charts"${c ? ' hidden' : ''}>
      ${card('ral', 'RAL por área')}
      ${card('rec', 'REC por área')}
    </section>
  </section>`;
}
function _v2ChartsToggleLabel(collapsed) { return collapsed ? '▸ Expandir gráficos' : '▾ Encolher gráficos'; }

/* Encolhe ou expande os dois gráficos */
function toggleV2Charts() {
  const c = !chartsCollapsed();
  try { localStorage.setItem(LS_CHARTS_COLLAPSED, c ? '1' : '0'); } catch (e) {}
  const wrap = document.getElementById('v2-charts-wrap'), box = document.getElementById('v2-charts'), btn = document.getElementById('v2-charts-toggle');
  if (wrap) wrap.classList.toggle('is-collapsed', c);
  if (box) box.hidden = c;
  if (btn) { btn.textContent = _v2ChartsToggleLabel(c); btn.setAttribute('aria-expanded', String(!c)); }
  if (!c) renderV2Charts();
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

/* Redesenha ao mudar o tamanho da tela (girar o celular, janela dividida etc.) */
let _v2ChartRz = 0;
window.addEventListener('resize', () => { clearTimeout(_v2ChartRz); _v2ChartRz = setTimeout(renderV2Charts, 150); });
