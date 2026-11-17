/* ══════════════════════════════════════════════════════════════
   LINHA DO TEMPO (RAL / REC) — fica logo abaixo dos grupos de áreas
   - Distribui os tickets pelo tempo desde a abertura:
     0–2h · 2–4h · 4–6h · 6–12h · 12–24h | 24–48h · 48–72h · +72h
   - Dois cartões no topo: dentro de 24h e mais de 24h (quantidade e %).
   - Escolhas: RAL ou REC · Todas, ≤ 24h ou > 24h · área (todas, minhas
     ou uma só). Ficam salvas neste aparelho.
   - Botão Recolher / Expandir (também salvo neste aparelho).
   - Tocar numa coluna abre a lista dos tickets daquela faixa.
   Desenho próprio em SVG (sem biblioteca externa → funciona offline).
   ══════════════════════════════════════════════════════════════ */

const LS_TL = 'sir_timeline_v1';   /* { tk, win, area, closed } */
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

function _tlOpts() {
  let o = {};
  try { o = JSON.parse(localStorage.getItem(LS_TL) || '{}') || {}; } catch (e) {}
  return { tk: o.tk === 'rec' ? 'rec' : 'ral', win: ['le', 'gt'].includes(o.win) ? o.win : 'all', area: o.area || '', closed: !!o.closed };
}
function _tlSave(p) { const o = { ..._tlOpts(), ...p }; try { localStorage.setItem(LS_TL, JSON.stringify(o)); } catch (e) {} return o; }

function _tlCfList() { const out = []; for (const cfs of Object.values(REGIONS)) out.push(...Object.keys(cfs)); return out; }
function _tlArea(o) {
  const mine = getUserSavedAreas();
  let a = o.area;
  if (!a) a = (mine.length && typeof getV2Scope === 'function' && getV2Scope() === 'mine') ? 'MINE' : 'ALL';
  if (a === 'MINE' && !mine.length) a = 'ALL';
  if (a !== 'ALL' && a !== 'MINE' && !_tlCfList().includes(a)) a = 'ALL';
  return a;
}
function _tlItems(tk, area) {
  const md = (modalData && modalData[tk]) || {};
  if (area === 'ALL') return md['ALL'] || [];
  if (area === 'MINE') return getUserSavedAreas().flatMap(cf => md[cf] || []);
  return md[area] || [];
}

/* Separa os tickets nas faixas de tempo */
function _tlData(tk, area) {
  const now = Date.now(), b = {};
  TL_BUCKETS.forEach(x => b[x.k] = []);
  let semData = 0;
  for (const it of _tlItems(tk, area)) {
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

function _tlSVG(tk, d, win, width) {
  const list = TL_BUCKETS.filter(x => win === 'all' || (win === 'le' ? x.hi <= 24 : x.lo >= 24));
  const W = Math.max(280, Math.round(width));
  const n = list.length, tilt = (W - 40) / n < 48;
  const H = 200, padL = 30, padR = 10, padT = 22, padB = tilt ? 40 : 28;
  const max = _niceMax(Math.max(1, ...list.map(x => d.b[x.k].length)));
  const iw = W - padL - padR, ih = H - padT - padB, band = iw / n;
  const x = i => padL + band * (i + 0.5), y = v => padT + ih - (v / max) * ih;
  const bw = Math.max(10, Math.min(46, band * 0.5));
  let g = `<defs>
    <linearGradient id="tl-le" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22d3ee" stop-opacity=".95"/><stop offset="100%" stop-color="#22d3ee" stop-opacity=".45"/></linearGradient>
    <linearGradient id="tl-gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:var(--v2-crit)" stop-opacity=".98"/><stop offset="100%" style="stop-color:var(--v2-crit)" stop-opacity=".5"/></linearGradient>
    <pattern id="tl-dots" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".8" fill="#fff" fill-opacity=".22"/></pattern></defs>`;
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
    const late = bk.lo >= 24, fill = late ? 'url(#tl-gt)' : 'url(#tl-le)', col = late ? 'var(--v2-crit)' : '#22d3ee';
    const rad = Math.min(4, bw / 2, h);
    const lbl = bk.t + (TL_SLA[tk] === bk.k ? ' (SLA)' : '');
    const bar = h > 0
      ? `<path d="M${(cx - bw / 2).toFixed(1)} ${y0} V${(top + rad).toFixed(1)} Q${(cx - bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx - bw / 2 + rad).toFixed(1)} ${top.toFixed(1)} H${(cx + bw / 2 - rad).toFixed(1)} Q${(cx + bw / 2).toFixed(1)} ${top.toFixed(1)} ${(cx + bw / 2).toFixed(1)} ${(top + rad).toFixed(1)} V${y0} Z" fill="${fill}" style="stroke:${col}" stroke-width="1"/>
         <path d="M${(cx - bw / 2).toFixed(1)} ${y0} V${top.toFixed(1)} H${(cx + bw / 2).toFixed(1)} V${y0} Z" fill="url(#tl-dots)" pointer-events="none"/>`
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

function _tlShellHTML() {
  const o = _tlOpts();
  return `<section class="v2-timeline${o.closed ? ' tl-closed' : ''}" id="v2-timeline">
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
      <button type="button" class="v2-charts-toggle tl-toggle" aria-expanded="${!o.closed}">${o.closed ? '▸ Expandir' : '▾ Recolher'}</button>
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
  const sec = document.getElementById('v2-timeline');
  if (!sec || !modalData || !modalData.ral) return;
  const o = _tlOpts(), tk = o.tk, area = _tlArea(o);
  const T = tk.toUpperCase();
  sec.querySelector('.tl-title').textContent = `Linha do Tempo · ${T}`;
  sec.querySelectorAll('.tl-seg').forEach(s => s.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === o[s.dataset.tlSet])));

  /* lista de áreas */
  const sel = sec.querySelector('.tl-area'), mine = getUserSavedAreas(), cfs = _tlCfList();
  sel.innerHTML = `<option value="ALL">Todas as áreas (${cfs.length} CFs)</option>` +
    (mine.length ? `<option value="MINE">Minhas áreas (${mine.length} CF${mine.length > 1 ? 's' : ''})</option>` : '') +
    Object.entries(REGIONS).map(([rn, c]) => `<optgroup label="${escapeHtml(rn)}">${Object.keys(c).map(cf => `<option value="${escapeHtml(cf)}">${escapeHtml(cf)}${CF_NAMES[cf] ? ' — ' + escapeHtml(CF_NAMES[cf]) : ''}</option>`).join('')}</optgroup>`).join('');
  sel.value = area;

  const d = _tlData(tk, area);
  sec._tlData = d;
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
  holder.innerHTML = _tlSVG(tk, d, o.win, holder.clientWidth || 600);
  sec.querySelector('.tl-note').textContent = d.semData ? `${d.semData} ${T} sem data de abertura não entra${d.semData > 1 ? 'm' : ''} no gráfico.` : '';
}

/* Abre a lista de uma faixa (as duas abas, RAL e REC, mostram a mesma faixa) */
function _tlOpenBucket(k) {
  const o = _tlOpts(), area = _tlArea(o), bk = TL_BUCKETS.find(x => x.k === k);
  if (!bk) return;
  const key = 'TL_' + k;
  for (const tk of ['ral', 'rec']) modalData[tk][key] = _tlData(tk, area).b[k];
  const aname = area === 'ALL' ? 'Todas as áreas' : area === 'MINE' ? 'Minhas áreas' : area;
  openModal(key, o.tk === 'ral', `${o.tk.toUpperCase()} :: ${bk.t} · ${aname}`);
}

document.addEventListener('click', e => {
  const sec = e.target.closest && e.target.closest('#v2-timeline');
  if (!sec) return;
  const segBtn = e.target.closest('.tl-seg button');
  if (segBtn) { _tlSave({ [segBtn.parentElement.dataset.tlSet]: segBtn.dataset.v }); renderTimeline(); return; }
  if (e.target.closest('.tl-toggle')) {
    const o = _tlSave({ closed: !_tlOpts().closed });
    sec.classList.toggle('tl-closed', o.closed);
    sec.querySelector('.tl-body').hidden = o.closed;
    const b = sec.querySelector('.tl-toggle');
    b.textContent = o.closed ? '▸ Expandir' : '▾ Recolher';
    b.setAttribute('aria-expanded', String(!o.closed));
    renderTimeline();
    return;
  }
  const col = e.target.closest('[data-tl-bucket]');
  if (col) _tlOpenBucket(col.dataset.tlBucket);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const col = e.target.closest && e.target.closest('[data-tl-bucket]');
  if (col) _tlOpenBucket(col.dataset.tlBucket);
});
document.addEventListener('change', e => {
  if (e.target.matches && e.target.matches('#v2-timeline .tl-area')) { _tlSave({ area: e.target.value }); renderTimeline(); }
});

/* Entra logo abaixo dos grupos de áreas sempre que o painel é redesenhado */
if (typeof renderDashboardV2 === 'function') {
  const _rdTl = renderDashboardV2;
  renderDashboardV2 = function () {
    const r = _rdTl.apply(this, arguments);
    try {
      const regs = document.querySelector('#main-grid .v2-regions');
      if (regs) { regs.insertAdjacentHTML('afterend', _tlShellHTML()); renderTimeline(); }
    } catch (e) { console.warn('linha do tempo', e); }
    return r;
  };
}

/* Redesenha ao mudar o tamanho da tela e a cada minuto (o tempo dos tickets anda) */
let _tlRz = 0;
window.addEventListener('resize', () => { clearTimeout(_tlRz); _tlRz = setTimeout(renderTimeline, 160); });
setInterval(() => { if (!document.hidden) renderTimeline(); }, 60000);
