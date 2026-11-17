/* ══════════════════════════════════════════════════════════════
   LINHA DO TEMPO (RAL / REC) — um gráfico só, no fim do painel
   (abaixo de todos os grupos de áreas)
   - Distribui os tickets pelo tempo desde a abertura:
     0–2h · 2–4h · 4–6h · 6–12h · 12–24h | 24–48h · 48–72h · +72h
   - Dois cartões no topo: dentro de 24h e mais de 24h (quantidade e %).
   - Escolhas: RAL ou REC · Todas, ≤ 24h ou > 24h · área: todas (completo),
     minhas áreas, um grupo (ES / Interior / Capital) ou um CF só.
     Ficam salvas neste aparelho, junto com o Recolher / Expandir.
   - Tocar numa coluna abre a lista dos tickets daquela faixa.
   Desenho próprio em SVG (sem biblioteca externa → funciona offline).
   ══════════════════════════════════════════════════════════════ */

const LS_TL = 'sir_timeline_v3';   /* { PAINEL: { tk, win, area, closed } } */
const TL_KEY = 'PAINEL';
const TL_BUCKETS = [
  { k: '0-2',   lo: 0,  hi: 2,        t: '0–2h' },
  { k: '2-4',   lo: 2,  hi: 4,        t: '2–4h' },
  { k: '4-6',   lo: 4,  hi: 6,        t: '4–6h' },
  { k: '6-12',  lo: 6,  hi: 12,       t: '6–12h' },
  { k: '12-24', lo: 12, hi: 24,       t: '12–24h' },
  { k: '24-48', lo: 24, hi: 48,       t: '24–48h' },
  { k: '48-72', lo: 48, hi: 72,       t: '48–72h' },
  { k: '72+',   lo: 72, hi: Infinity, t: '+72h' },
];
const TL_SLA = { ral: '4-6', rec: '2-4' };   /* faixa em que o SLA vence: RAL 6h · REC 4h */

function _tlAll() { try { const v = JSON.parse(localStorage.getItem(LS_TL) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function _tlOpts(rn) {
  const o = _tlAll()[rn] || {};
  return { tk: o.tk === 'rec' ? 'rec' : 'ral', win: ['le', 'gt'].includes(o.win) ? o.win : 'all', area: o.area || 'ALL', closed: !!o.closed };
}
function _tlSave(rn, p) {
  const all = _tlAll(), o = { ..._tlOpts(rn), ...p };
  all[rn] = o;
  try { localStorage.setItem(LS_TL, JSON.stringify(all)); } catch (e) {}
  return o;
}

/* Áreas de cada escolha: ALL (todas), MINE (minhas), G:<grupo> ou um CF */
const _tlAllCfs = () => Object.values(REGIONS).flatMap(c => Object.keys(c));
function _tlAreaCfs(area) {
  if (area === 'MINE') return getUserSavedAreas();
  if (String(area).startsWith('G:')) return Object.keys(REGIONS[area.slice(2)] || {});
  if (area && area !== 'ALL') return [area];
  return _tlAllCfs();
}
function _tlArea(rn, o) {
  const a = o.area || 'ALL';
  if (a === 'MINE') return getUserSavedAreas().length ? a : 'ALL';
  if (a.startsWith('G:')) return REGIONS[a.slice(2)] ? a : 'ALL';
  return a === 'ALL' || _tlAllCfs().includes(a) ? a : 'ALL';
}
function _tlAreaName(area) {
  if (area === 'ALL') return 'Todas as áreas';
  if (area === 'MINE') return 'Minhas áreas';
  if (area.startsWith('G:')) return area.slice(2);
  return area;
}
function _tlItems(tk, rn, area) {
  const md = (modalData && modalData[tk]) || {};
  return _tlAreaCfs(area).flatMap(cf => md[cf] || []);
}

/* Separa os tickets nas faixas de tempo */
function _tlData(tk, rn, area) {
  const now = Date.now(), b = {};
  TL_BUCKETS.forEach(x => b[x.k] = []);
  let semData = 0;
  for (const it of _tlItems(tk, rn, area)) {
    const t = parseAbertura(it.abertura);
    if (!t) { semData++; continue; }
    const h = Math.max(0, (now - t) / 3600000);
    const bk = TL_BUCKETS.find(x => h >= x.lo && h < x.hi) || TL_BUCKETS[TL_BUCKETS.length - 1];
    b[bk.k].push(it);
  }
  const le = TL_BUCKETS.filter(x => x.hi <= 24).reduce((s, x) => s + b[x.k].length, 0);
  const gt = TL_BUCKETS.filter(x => x.lo >= 24).reduce((s, x) => s + b[x.k].length, 0);
  return { b, le, gt, total: le + gt, semData };
}

function _tlSVG(tk, d, win, width, uid) {
  const list = TL_BUCKETS.filter(x => win === 'all' || (win === 'le' ? x.hi <= 24 : x.lo >= 24));
  const W = Math.max(280, Math.round(width));
  const n = list.length, tilt = (W - 40) / n < 48;
  const H = 190, padL = 30, padR = 10, padT = 22, padB = tilt ? 40 : 28;
  const max = _niceMax(Math.max(1, ...list.map(x => d.b[x.k].length)));
  const iw = W - padL - padR, ih = H - padT - padB, band = iw / n;
  const x = i => padL + band * (i + 0.5), y = v => padT + ih - (v / max) * ih;
  const bw = Math.max(10, Math.min(46, band * 0.5));
  let g = `<defs>
    <linearGradient id="tl-le${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22d3ee" stop-opacity=".95"/><stop offset="100%" stop-color="#22d3ee" stop-opacity=".45"/></linearGradient>
    <linearGradient id="tl-gt${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--v2-crit)" stop-opacity=".98"/><stop offset="100%" style="stop-color:var(--v2-crit)" stop-opacity=".5"/></linearGradient>
    <pattern id="tl-dots${uid}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".8" fill="#fff" fill-opacity=".22"/></pattern></defs>`;
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k, yy = y(v);
    g += `<line class="g-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke-dasharray="${k ? '3 4' : ''}" opacity="${k ? .55 : .9}"/>`;
    g += `<text class="g-axis" x="${padL - 6}" y="${yy + 3.5}" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  /* divisória das 24h (só quando aparecem as duas metades) */
  if (win === 'all') {
    const xd = padL + band * 5;
    g += `<line class="tl-div" x1="${xd}" x2="${xd}" y1="${padT - 12}" y2="${padT + ih}" stroke-dasharray="3 4"/>`;
    g += `<text class="g-axis" x="${xd}" y="${padT - 14}" text-anchor="middle">24h</text>`;
  }
  const y0 = y(0);
  list.forEach((bk, i) => {
    const v = d.b[bk.k].length, cx = x(i), top = y(v), h = Math.max(0, y0 - top);
    const late = bk.lo >= 24, fill = `url(#${late ? 'tl-gt' : 'tl-le'}${uid})`, col = late ? 'var(--v2-crit)' : '#22d3ee';
    const rad = Math.min(4, bw / 2, h);
    const lbl = bk.t + (TL_SLA[tk] === bk.k ? ' (SLA)' : '');
    const bar = h > 0
      ? `<path d="M${(cx - bw / 2).toFixed(1)} ${y0} V${(top + rad).toFixed(1)} Q${(cx - bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx - bw / 2 + rad).toFixed(1)} ${top.toFixed(1)} H${(cx + bw / 2 - rad).toFixed(1)} Q${(cx + bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx + bw / 2).toFixed(1)} ${(top + rad).toFixed(1)} V${y0} Z" fill="${fill}" style="stroke:${col}" stroke-width="1"/>
         <path d="M${(cx - bw / 2).toFixed(1)} ${y0} V${top.toFixed(1)} H${(cx + bw / 2).toFixed(1)} V${y0} Z" fill="url(#tl-dots${uid})" pointer-events="none"/>`
      : `<line class="g-zero" x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y0 - 0.5}" y2="${y0 - 0.5}" stroke-width="2"/>`;
    const lx = tilt
      ? `<text class="g-x" x="${cx}" y="${H - padB + 12}" text-anchor="end" transform="rotate(-40 ${cx} ${H - padB + 12})" style="font-size:9px">${lbl}</text>`
      : `<text class="g-x" x="${cx}" y="${H - 9}" text-anchor="middle">${lbl}</text>`;
    g += `<g class="g-col tl-col" data-tl-bucket="${bk.k}" role="button" tabindex="0" aria-label="${tk.toUpperCase()} ${lbl}: ${v}">
      <title>${tk.toUpperCase()} ${lbl}: ${v} — toque para abrir a lista</title>
      <rect class="g-hit" x="${(cx - band / 2).toFixed(1)}" y="${padT - 8}" width="${band.toFixed(1)}" height="${ih + 8}"/>
      ${bar}
      <text class="g-val" x="${cx}" y="${top - 6}" text-anchor="middle" style="fill:${v ? col : 'var(--text-muted)'}">${v}</text>
      ${lx}
    </g>`;
  });
  return `<svg class="v2-chart-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Linha do tempo ${tk.toUpperCase()}">${g}</svg>`;
}

function _tlShellHTML(rn) {
  const o = _tlOpts(rn);
  return `<section class="v2-timeline${o.closed ? ' tl-closed' : ''}" data-tl-reg="${escapeHtml(rn)}">
    <div class="tl-head">
      <div class="tl-title-wrap">
        <span class="tl-dot"></span>
        <div><div class="tl-title"></div><div class="tl-sub">Distribuição por tempo decorrido (≤ 24h vs &gt; 24h)</div></div>
      </div>
      <div class="tl-ctrls">
        <div class="tl-seg" data-tl-set="tk"><button type="button" data-v="ral">RAL</button><button type="button" data-v="rec">REC</button></div>
        <div class="tl-seg" data-tl-set="win"><button type="button" data-v="all">Todas</button><button type="button" data-v="le">≤ 24h</button><button type="button" data-v="gt">&gt; 24h</button></div>
        <select class="tl-area" aria-label="Área"></select>
        <span class="tl-pill"></span>
      </div>
      <button type="button" class="v2-charts-toggle tl-toggle" aria-expanded="${!o.closed}" title="Recolher ou expandir a Linha do Tempo">${o.closed ? '▸ Expandir' : '▾ Recolher'}</button>
    </div>
    <div class="tl-body"${o.closed ? ' hidden' : ''}>
      <div class="tl-cards">
        <div class="tl-card tl-le"><div class="tl-card-top"><span>Dentro de 24h (≤ 24h)</span><b></b></div><div class="tl-track"><i></i></div></div>
        <div class="tl-card tl-gt"><div class="tl-card-top"><span>Mais de 24h (&gt; 24h)</span><b></b></div><div class="tl-track"><i></i></div></div>
      </div>
      <div class="tl-chart"></div>
      <div class="tl-note"></div>
    </div>
  </section>`;
}

function renderTimeline() {
  document.querySelectorAll('.v2-timeline[data-tl-reg]').forEach(sec => _tlRenderOne(sec, sec.dataset.tlReg));
}
function _tlRenderOne(sec, uid) {
  if (!modalData || !modalData.ral) return;
  const rn = sec.dataset.tlReg, o = _tlOpts(rn), tk = o.tk, area = _tlArea(rn, o);
  const T = tk.toUpperCase();
  sec.querySelector('.tl-title').textContent = `Linha do Tempo · ${T}${area === 'ALL' ? '' : ' · ' + _tlAreaName(area)}`;
  sec.querySelectorAll('.tl-seg').forEach(s => s.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === o[s.dataset.tlSet])));

  /* áreas: todas, minhas, grupos e cada CF */
  const sel = sec.querySelector('.tl-area'), mine = getUserSavedAreas(), all = _tlAllCfs();
  const cfOpt = cf => `<option value="${escapeHtml(cf)}">${escapeHtml(cf)}${CF_NAMES[cf] ? ' — ' + escapeHtml(CF_NAMES[cf]) : ''}</option>`;
  sel.innerHTML = `<option value="ALL">Todas as áreas (${all.length} CFs)</option>` +
    (mine.length ? `<option value="MINE">Minhas áreas (${mine.length} CF${mine.length > 1 ? 's' : ''})</option>` : '') +
    `<optgroup label="Grupos">${Object.entries(REGIONS).map(([g, c]) => `<option value="G:${escapeHtml(g)}">${escapeHtml(g)} (${Object.keys(c).length} CFs)</option>`).join('')}</optgroup>` +
    Object.entries(REGIONS).map(([g, c]) => `<optgroup label="${escapeHtml(g)}">${Object.keys(c).map(cfOpt).join('')}</optgroup>`).join('');
  sel.value = area;

  const d = _tlData(tk, rn, area);
  sec.querySelector('.tl-pill').innerHTML = `<b>${d.total}</b> ${tk === 'ral' ? 'RALs de falha' : 'RECs'}`;
  const pct = v => d.total ? Math.round(v / d.total * 100) : 0;
  const le = sec.querySelector('.tl-le'), gt = sec.querySelector('.tl-gt');
  le.querySelector('b').innerHTML = `${d.le} <small>(${pct(d.le)}%)</small>`;
  gt.querySelector('b').innerHTML = `${d.gt} <small>(${pct(d.gt)}%)</small>`;
  le.querySelector('.tl-track i').style.width = pct(d.le) + '%';
  gt.querySelector('.tl-track i').style.width = pct(d.gt) + '%';
  le.classList.toggle('dim', o.win === 'gt'); gt.classList.toggle('dim', o.win === 'le');

  if (o.closed) return;
  const holder = sec.querySelector('.tl-chart');
  holder.innerHTML = _tlSVG(tk, d, o.win, holder.clientWidth || 600, uid);
  sec.querySelector('.tl-note').textContent = d.semData ? `${d.semData} ${T} sem data de abertura não entra${d.semData > 1 ? 'm' : ''} no gráfico.` : '';
}

/* Abre a lista de uma faixa (as duas abas, RAL e REC, mostram a mesma faixa) */
function _tlOpenBucket(rn, k) {
  const o = _tlOpts(rn), area = _tlArea(rn, o), bk = TL_BUCKETS.find(x => x.k === k);
  if (!bk) return;
  const key = `TL_${rn}_${k}`;
  for (const tk of ['ral', 'rec']) modalData[tk][key] = _tlData(tk, rn, area).b[k];
  openModal(key, o.tk === 'ral', `${o.tk.toUpperCase()} :: ${bk.t} · ${_tlAreaName(area)}`);
}

document.addEventListener('click', e => {
  const sec = e.target.closest && e.target.closest('.v2-timeline[data-tl-reg]');
  if (!sec) return;
  const rn = sec.dataset.tlReg;
  const segBtn = e.target.closest('.tl-seg button');
  if (segBtn) { _tlSave(rn, { [segBtn.parentElement.dataset.tlSet]: segBtn.dataset.v }); _tlRenderOne(sec, rn); return; }
  if (e.target.closest('.tl-toggle')) {
    const o = _tlSave(rn, { closed: !_tlOpts(rn).closed });
    sec.classList.toggle('tl-closed', o.closed);
    sec.querySelector('.tl-body').hidden = o.closed;
    const b = sec.querySelector('.tl-toggle');
    b.textContent = o.closed ? '▸ Expandir' : '▾ Recolher';
    b.setAttribute('aria-expanded', String(!o.closed));
    _tlRenderOne(sec, rn);
    return;
  }
  const col = e.target.closest('[data-tl-bucket]');
  if (col) _tlOpenBucket(rn, col.dataset.tlBucket);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const col = e.target.closest && e.target.closest('[data-tl-bucket]');
  if (col) _tlOpenBucket(col.closest('.v2-timeline').dataset.tlReg, col.dataset.tlBucket);
});
document.addEventListener('change', e => {
  const sel = e.target.matches && e.target.matches('.v2-timeline .tl-area') ? e.target : null;
  if (!sel) return;
  const sec = sel.closest('.v2-timeline');
  _tlSave(sec.dataset.tlReg, { area: sel.value }); _tlRenderOne(sec, sec.dataset.tlReg);
});

/* Entra no fim do painel, abaixo de todos os grupos, sempre que o painel é redesenhado */
if (typeof renderDashboardV2 === 'function') {
  const _rdTl = renderDashboardV2;
  renderDashboardV2 = function () {
    const r = _rdTl.apply(this, arguments);
    try {
      const regs = document.querySelector('#main-grid .v2-regions');
      if (regs) regs.insertAdjacentHTML('afterend', _tlShellHTML(TL_KEY));
      renderTimeline();
    } catch (e) { console.warn('linha do tempo', e); }
    return r;
  };
}

/* Redesenha ao mudar o tamanho da tela e a cada minuto (o tempo dos tickets anda) */
let _tlRz = 0;
window.addEventListener('resize', () => { clearTimeout(_tlRz); _tlRz = setTimeout(renderTimeline, 160); });
setInterval(() => { if (!document.hidden) renderTimeline(); }, 60000);

