/* ══════════════════════════════════════════════════════════════
   LINHA DO TEMPO (RAL / REC) — um gráfico só, no fim do painel
   (abaixo de todos os grupos de áreas)  — v53: por hora do dia
   - Eixo X: as 24 horas do dia, de 00h até 23:59 (hora de abertura).
   - Eixo Y: volume de tickets abertos naquela hora.
   - Cada coluna empilha: ciano = aberto nas últimas 24h ·
     laranja = aberto há mais de 24h (dias anteriores).
   - Linha "agora" anda pelo eixo X acompanhando o relógio; as horas
     depois dela (nas últimas 24h) são de ontem.
   - Dois cartões no topo: dentro de 24h e mais de 24h (quantidade e %).
   - Escolhas: RAL ou REC · Todas, ≤ 24h ou > 24h · área: todas (completo),
     minhas áreas, um grupo (ES / Interior / Capital) ou um CF só.
     Ficam salvas neste aparelho, junto com o Recolher / Expandir.
   - Tocar numa coluna abre a lista dos tickets daquela hora.
   Desenho próprio em SVG (sem biblioteca externa → funciona offline).
   ══════════════════════════════════════════════════════════════ */

const TL_KEY = 'PAINEL';
const TL_HOURS = Array.from({ length: 24 }, (_, h) => h);
const _tlHH = h => String(h).padStart(2, '0');

function _tlAll() { return SirStore.get('timeline'); }   /* v67: via SirStore */
function _tlOpts(rn) {
  const o = _tlAll()[rn] || {};
  return { tk: o.tk === 'rec' ? 'rec' : 'ral', win: ['le', 'gt'].includes(o.win) ? o.win : 'all', area: o.area || 'ALL', closed: !!o.closed };
}
function _tlSave(rn, p) {
  const all = _tlAll(), o = { ..._tlOpts(rn), ...p };
  all[rn] = o;
  SirStore.set('timeline', all);
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

/* Separa os tickets pela hora de abertura (0–23) e pelo tempo decorrido (≤ 24h / > 24h) */
function _tlData(tk, rn, area) {
  const now = Date.now(), b = {};
  TL_HOURS.forEach(h => b[h] = { le: [], gt: [] });
  let semData = 0, le = 0, gt = 0;
  for (const it of _tlItems(tk, rn, area)) {
    const t = parseAbertura(it.abertura);
    if (!t) { semData++; continue; }
    const hr = new Date(t).getHours(), old = (now - t) / 3600000 > 24;
    b[hr][old ? 'gt' : 'le'].push(it);
    old ? gt++ : le++;
  }
  return { b, le, gt, total: le + gt, semData };
}
function _tlHourItems(d, h, win) {
  const c = d.b[h];
  return win === 'le' ? c.le : win === 'gt' ? c.gt : c.le.concat(c.gt);
}

function _tlSVG(tk, d, win, width, uid) {
  const W = Math.max(300, Math.round(width));
  const H = 230, padL = 32, padR = 16, padT = 30, padB = 46;
  const iw = W - padL - padR, ih = H - padT - padB, band = iw / 24;
  const showLe = win !== 'gt', showGt = win !== 'le';
  const vLe = h => showLe ? d.b[h].le.length : 0, vGt = h => showGt ? d.b[h].gt.length : 0;
  const max = _niceMax(Math.max(1, ...TL_HOURS.map(h => vLe(h) + vGt(h))));
  const xL = h => padL + band * h;                       /* início da hora h no eixo */
  const y = v => padT + ih - (v / max) * ih, y0 = y(0);
  const dep = Math.max(2, Math.min(7, band * 0.16));
  const bw = Math.max(4, Math.min(30, band * 0.62 - dep));
  const cLe = '#22d3ee', cGt = 'var(--v2-crit)';
  const step = band >= 30 ? 1 : band >= 15 ? 2 : band >= 10 ? 3 : 6;   /* rótulos de hora visíveis */

  let g = `<defs>${_vGradDef('tl-le' + uid, cLe, 1, .6)}${_vGradDef('tl-gt' + uid, cGt, 1, .62)}${_shineDef('tl-sh' + uid)}
    <linearGradient id="tl-now${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#22d3ee" stop-opacity="0"/><stop offset="100%" stop-color="#22d3ee" stop-opacity=".10"/></linearGradient></defs>`;

  /* "agora": posição do relógio no eixo das 24h */
  const nd = new Date(), nowH = nd.getHours() + nd.getMinutes() / 60, xNow = padL + band * nowH;
  /* faixa leve de "hoje até agora" */
  g += `<rect x="${padL}" y="${padT - 6}" width="${(xNow - padL).toFixed(1)}" height="${(ih + 6).toFixed(1)}" fill="url(#tl-now${uid})" pointer-events="none"/>`;

  /* grade + eixo Y (volume) */
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k, yy = y(v);
    g += `<line class="g-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke-dasharray="${k ? '3 4' : ''}" opacity="${k ? .55 : .9}"/>`;
    g += `<text class="g-axis" x="${padL - 6}" y="${yy + 3.5}" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  g += `<text class="g-axis tl-ax-t" x="${padL - 26}" y="${padT - 14}" text-anchor="start">tickets</text>`;

  /* eixo X (tempo): marcas de cada hora + rótulos 00h … 23h + 23:59 no fim */
  TL_HOURS.forEach(h => {
    const xx = xL(h);
    g += `<line class="tl-tick" x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${y0}" y2="${y0 + (h % step ? 3 : 6)}"/>`;
    if (h % step === 0) g += `<text class="g-x" x="${(xx + band / 2).toFixed(1)}" y="${y0 + 18}" text-anchor="middle">${_tlHH(h)}h</text>`;
  });
  g += `<line class="tl-tick" x1="${padL + iw}" x2="${padL + iw}" y1="${y0}" y2="${y0 + 6}"/>`;
  g += `<text class="g-axis tl-ax-t" x="${padL + iw}" y="${H - 6}" text-anchor="end">23:59</text>`;
  g += `<text class="g-axis tl-ax-t" x="${padL}" y="${H - 6}" text-anchor="start">00:00</text>`;
  g += `<text class="g-axis tl-ax-t" x="${padL + iw / 2}" y="${H - 6}" text-anchor="middle">hora de abertura</text>`;

  /* colunas (empilhadas: ≤ 24h embaixo, > 24h em cima) */
  TL_HOURS.forEach(h => {
    const a = vLe(h), bq = vGt(h), tot = a + bq, x0 = xL(h) + (band - bw - dep) / 2, cx = xL(h) + band / 2;
    const tA = y(a), tT = y(tot);
    let bar = '';
    if (a) bar += _bar3D(x0, bw, tA, y0, 'tl-le' + uid, cLe, dep, { shineId: 'tl-sh' + uid, noCap: bq > 0 });
    if (bq) bar += _bar3D(x0, bw, tT, tA, 'tl-gt' + uid, cGt, dep, { shineId: 'tl-sh' + uid });
    if (!tot) bar = `<line class="g-zero" x1="${(cx - bw / 2).toFixed(1)}" x2="${(cx + bw / 2).toFixed(1)}" y1="${y0 - 0.5}" y2="${y0 - 0.5}" stroke-width="2"/>`;
    const col = bq ? cGt : cLe;
    const lbl = `${tk.toUpperCase()} ${_tlHH(h)}:00–${_tlHH(h)}:59`;
    const det = [showLe ? `${a} nas últimas 24h` : '', showGt ? `${bq} há mais de 24h` : ''].filter(Boolean).join(' · ');
    g += `<g class="g-col tl-col${h === nd.getHours() ? ' tl-cur' : ''}" data-tl-bucket="${h}" role="button" tabindex="0" aria-label="${lbl}: ${tot}">
      <title>${lbl}: ${tot} (${det}) — toque para abrir a lista</title>
      <rect class="g-hit" x="${xL(h).toFixed(1)}" y="${padT - 8}" width="${band.toFixed(1)}" height="${ih + 8}"/>
      ${bar}
      ${tot ? `<text class="g-val" x="${(cx + dep / 2).toFixed(1)}" y="${(tT - dep - 5).toFixed(1)}" text-anchor="middle" style="fill:${col}">${tot}</text>` : ''}
    </g>`;
  });

  /* linha do "agora" acompanhando o relógio */
  const hm = `${_tlHH(nd.getHours())}:${_tlHH(nd.getMinutes())}`;
  const lx = Math.min(Math.max(xNow, padL + 32), W - padR - 32);
  g += `<line class="tl-now" x1="${xNow.toFixed(1)}" x2="${xNow.toFixed(1)}" y1="${padT - 10}" y2="${y0 + 6}"/>
    <circle class="tl-now-dot" cx="${xNow.toFixed(1)}" cy="${y0}" r="3.5"/>
    <g class="tl-now-tag"><rect x="${(lx - 32).toFixed(1)}" y="${padT - 26}" width="64" height="15" rx="7.5"/>
    <text x="${lx.toFixed(1)}" y="${padT - 15}" text-anchor="middle">agora ${hm}</text></g>`;

  return `<svg class="v2-chart-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Linha do tempo ${tk.toUpperCase()} por hora de abertura">${g}</svg>`;
}

function _tlShellHTML(rn) {
  const o = _tlOpts(rn);
  return `<section class="v2-timeline${o.closed ? ' tl-closed' : ''}" data-tl-reg="${escapeHtml(rn)}">
    <div class="tl-head">
      <div class="tl-title-wrap">
        <span class="tl-dot"></span>
        <div><div class="tl-title"></div><div class="tl-sub">Volume por hora de abertura (00h–23:59) · <i class="tl-key tl-key-le"></i>≤ 24h <i class="tl-key tl-key-gt"></i>&gt; 24h</div></div>
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
  const opts = `<option value="ALL">Todas as áreas (${all.length} CFs)</option>` +
    (mine.length ? `<option value="MINE">Minhas áreas (${mine.length} CF${mine.length > 1 ? 's' : ''})</option>` : '') +
    `<optgroup label="Grupos">${Object.entries(REGIONS).map(([g, c]) => `<option value="G:${escapeHtml(g)}">${escapeHtml(g)} (${Object.keys(c).length} CFs)</option>`).join('')}</optgroup>` +
    Object.entries(REGIONS).map(([g, c]) => `<optgroup label="${escapeHtml(g)}">${Object.keys(c).map(cfOpt).join('')}</optgroup>`).join('');
  /* v67: só refaz a lista se mudou (não fecha o menu aberto a cada atualização) */
  if (sel._opts !== opts) { sel.innerHTML = opts; sel._opts = opts; }
  if (sel.value !== area) sel.value = area;

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

/* Abre a lista de uma hora (as duas abas, RAL e REC, mostram a mesma hora) */
function _tlOpenBucket(rn, k) {
  const o = _tlOpts(rn), area = _tlArea(rn, o), h = parseInt(k, 10);
  if (!(h >= 0 && h < 24)) return;
  const key = `TL_${rn}_${h}`;
  for (const tk of ['ral', 'rec']) modalData[tk][key] = _tlHourItems(_tlData(tk, rn, area), h, o.win);
  const w = o.win === 'le' ? ' · ≤ 24h' : o.win === 'gt' ? ' · > 24h' : '';
  openModal(key, o.tk === 'ral', `${o.tk.toUpperCase()} :: aberto ${_tlHH(h)}:00–${_tlHH(h)}:59${w} · ${_tlAreaName(area)}`);
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
      /* v67: a seção fica na tela entre as atualizações; só é criada se ainda não existir */
      if (regs && !document.querySelector('#main-grid > .v2-timeline')) regs.insertAdjacentHTML('afterend', _tlShellHTML(TL_KEY));
      renderTimeline();
    } catch (e) { console.warn('linha do tempo', e); }
    return r;
  };
}

/* Redesenha ao mudar o tamanho da tela e a cada minuto (o tempo dos tickets anda) */
let _tlRz = 0;
window.addEventListener('resize', () => { clearTimeout(_tlRz); _tlRz = setTimeout(renderTimeline, 160); });
setInterval(() => { if (!document.hidden) renderTimeline(); }, 60000);

