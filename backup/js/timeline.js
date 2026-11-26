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

/* v78: barras planas empilhadas (sem 3D), laranja para "> 24h", coluna da hora atual
   destacada e animação de entrada (só quando .tl-anim está na seção) */
const TL_C_LE = '#22d3ee', TL_C_GT = '#fb923c';
function _tlBarPath(x, w, top, bot, r) {
  const h = bot - top; if (h <= 0) return '';
  r = Math.max(0, Math.min(r, w / 2, h));
  return `M${x.toFixed(1)} ${bot.toFixed(1)}V${(top + r).toFixed(1)}Q${x.toFixed(1)} ${top.toFixed(1)} ${(x + r).toFixed(1)} ${top.toFixed(1)}` +
    `H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)} ${top.toFixed(1)} ${(x + w).toFixed(1)} ${(top + r).toFixed(1)}V${bot.toFixed(1)}Z`;
}
function _tlSVG(tk, d, win, width, uid) {
  const W = Math.max(300, Math.round(width));
  const H = 230, padL = 32, padR = 16, padT = 34, padB = 42;
  const iw = W - padL - padR, ih = H - padT - padB, band = iw / 24;
  const showLe = win !== 'gt', showGt = win !== 'le';
  const vLe = h => showLe ? d.b[h].le.length : 0, vGt = h => showGt ? d.b[h].gt.length : 0;
  const max = _niceMax(Math.max(1, ...TL_HOURS.map(h => vLe(h) + vGt(h))));
  const xL = h => padL + band * h;
  const y = v => padT + ih - (v / max) * ih, y0 = y(0);
  const bw = Math.max(4, Math.min(28, band * 0.66));
  const step = band >= 30 ? 1 : band >= 15 ? 2 : band >= 10 ? 3 : 6;
  const nd = new Date(), curH = nd.getHours(), nowH = curH + nd.getMinutes() / 60, xNow = padL + band * nowH;

  let g = `<defs><linearGradient id="tl-now${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${TL_C_LE}" stop-opacity="0"/><stop offset="100%" stop-color="${TL_C_LE}" stop-opacity=".07"/></linearGradient></defs>`;
  /* faixa leve de "hoje até agora" (as colunas depois dela são de ontem) */
  g += `<rect x="${padL}" y="${padT - 6}" width="${(xNow - padL).toFixed(1)}" height="${(ih + 6).toFixed(1)}" fill="url(#tl-now${uid})" pointer-events="none"/>`;
  /* coluna da hora atual */
  g += `<rect class="tl-cur-bg" x="${(xL(curH) + 1).toFixed(1)}" y="${padT - 8}" width="${(band - 2).toFixed(1)}" height="${(ih + 8).toFixed(1)}" rx="6" pointer-events="none"/>`;

  /* grade + eixo Y */
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k, yy = y(v);
    g += `<line class="g-grid" x1="${padL}" x2="${W - padR}" y1="${yy}" y2="${yy}" stroke-dasharray="${k ? '3 4' : ''}" opacity="${k ? .4 : .9}"/>`;
    g += `<text class="g-axis" x="${padL - 6}" y="${yy + 3.5}" text-anchor="end">${Math.round(v * 10) / 10}</text>`;
  }
  /* eixo X */
  TL_HOURS.forEach(h => {
    if (h % step) return;
    g += `<text class="g-x${h === curH ? ' tl-x-cur' : ''}" x="${(xL(h) + band / 2).toFixed(1)}" y="${y0 + 17}" text-anchor="middle">${_tlHH(h)}h</text>`;
  });
  g += `<text class="g-axis tl-ax-t" x="${padL + iw / 2}" y="${H - 6}" text-anchor="middle">hora de abertura</text>`;

  /* colunas: ≤ 24h embaixo, > 24h em cima, 2px de respiro entre as duas */
  TL_HOURS.forEach(h => {
    const a = vLe(h), bq = vGt(h), tot = a + bq, cx = xL(h) + band / 2, x0 = cx - bw / 2;
    const tA = y(a), tT = y(tot), gap = a && bq ? 2 : 0;
    const dl = (h * 0.035).toFixed(3);
    let bar = '';
    if (a) bar += `<path class="tl-seg-le" style="animation-delay:${dl}s" fill="${TL_C_LE}" d="${_tlBarPath(x0, bw, tA, y0, bq ? 0 : 3.5)}"/>`;
    if (bq) bar += `<path class="tl-seg-gt" style="animation-delay:${(+dl + .25).toFixed(3)}s" fill="${TL_C_GT}" d="${_tlBarPath(x0, bw, tT, tA - gap, 3.5)}"/>`;
    if (!tot) bar = `<line class="g-zero" x1="${(cx - bw / 2).toFixed(1)}" x2="${(cx + bw / 2).toFixed(1)}" y1="${y0 - 0.5}" y2="${y0 - 0.5}" stroke-width="2"/>`;
    const col = bq > a ? TL_C_GT : TL_C_LE;
    const lbl = `${tk.toUpperCase()} ${_tlHH(h)}:00–${_tlHH(h)}:59`;
    g += `<g class="g-col tl-col${h === curH ? ' tl-cur' : ''}" data-tl-bucket="${h}" data-le="${a}" data-gt="${bq}" role="button" tabindex="0" aria-label="${lbl}: ${tot} (${a} nas últimas 24h, ${bq} há mais de 24h)">
      <rect class="g-hit" x="${xL(h).toFixed(1)}" y="${padT - 8}" width="${band.toFixed(1)}" height="${ih + 8}"/>
      <g class="tl-stack">${bar}</g>
      ${tot ? `<text class="g-val tl-val" x="${cx.toFixed(1)}" y="${(tT - 6).toFixed(1)}" text-anchor="middle" style="fill:${col};animation-delay:${(+dl + .5).toFixed(3)}s">${tot}</text>` : ''}
    </g>`;
  });

  /* etiqueta "agora" sobre a coluna da hora atual */
  const hm = `${_tlHH(curH)}:${_tlHH(nd.getMinutes())}`;
  const lx = Math.min(Math.max(xL(curH) + band / 2, padL + 30), W - padR - 30);
  g += `<g class="tl-now-tag"><rect x="${(lx - 30).toFixed(1)}" y="${padT - 32}" width="60" height="16" rx="8"/>
    <text x="${lx.toFixed(1)}" y="${padT - 20.5}" text-anchor="middle">agora ${hm}</text></g>`;

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
        <div class="tl-card tl-peak"><div class="tl-card-top"><span>Pico do dia</span></div><b class="tl-peak-v"></b></div>
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
  const anim = !o.closed && (_tlAnimNext || sec._tlAnim) && !_tlReduce();
  if (!o.closed) { _tlAnimNext = false; sec._tlAnim = false; }
  const tLe = le.querySelector('.tl-track i'), tGt = gt.querySelector('.tl-track i');
  if (anim) { tLe.style.width = tGt.style.width = '0%'; void tLe.offsetWidth; }
  tLe.style.width = pct(d.le) + '%';
  tGt.style.width = pct(d.gt) + '%';
  _tlCount(le.querySelector('b'), d.le, pct(d.le), anim);
  _tlCount(gt.querySelector('b'), d.gt, pct(d.gt), anim);
  le.classList.toggle('dim', o.win === 'gt'); gt.classList.toggle('dim', o.win === 'le');
  let ph = -1, pv = 0;
  TL_HOURS.forEach(h => { const n = _tlHourItems(d, h, o.win).length; if (n > pv) { pv = n; ph = h; } });
  sec.querySelector('.tl-peak-v').innerHTML = ph < 0 ? '—' : `${_tlHH(ph)}h <small>${pv} ${pv > 1 ? T + 's' : T}</small>`;

  if (o.closed) return;
  const holder = sec.querySelector('.tl-chart');
  holder.innerHTML = _tlSVG(tk, d, o.win, holder.clientWidth || 600, uid) + '<div class="tl-tip" hidden></div>';
  if (anim) {
    sec.classList.add('tl-anim');
    clearTimeout(sec._tlAt);
    sec._tlAt = setTimeout(() => sec.classList.remove('tl-anim'), 2200);
  }
  sec.querySelector('.tl-note').textContent = d.semData ? `${d.semData} ${T} sem data de abertura não entra${d.semData > 1 ? 'm' : ''} no gráfico.` : '';
}

/* v78: animação só ao abrir o painel, trocar filtro/área ou expandir — não nas atualizações automáticas */
let _tlAnimNext = true;
const _tlReduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function _tlCount(el, val, p, anim) {
  const put = v => { el.innerHTML = `${v} <small>(${p}%)</small>`; };
  cancelAnimationFrame(el._tlRaf);
  if (!anim || !val) return put(val);
  const t0 = performance.now();
  const step = now => {
    const k = Math.min((now - t0) / 1100, 1);
    put(Math.round(val * (1 - Math.pow(1 - k, 3))));
    if (k < 1) el._tlRaf = requestAnimationFrame(step);
  };
  el._tlRaf = requestAnimationFrame(step);
}

/* Balão ao passar o mouse / focar uma coluna */
function _tlShowTip(col) {
  const holder = col.closest('.tl-chart'), tip = holder && holder.querySelector('.tl-tip');
  if (!tip) return;
  const sec = col.closest('.v2-timeline'), T = _tlOpts(sec.dataset.tlReg).tk.toUpperCase();
  const h = +col.dataset.tlBucket, a = +col.dataset.le, b = +col.dataset.gt;
  tip.innerHTML = `<b>${_tlHH(h)}h · ${a + b} ${T}</b><span><i class="tl-key tl-key-le"></i>${a} até 24h · <i class="tl-key tl-key-gt"></i>${b} mais de 24h</span><em>Toque para ver a lista</em>`;
  tip.hidden = false;
  const hr = holder.getBoundingClientRect(), cr = col.getBoundingClientRect();
  const x = Math.min(Math.max(cr.left - hr.left + cr.width / 2, tip.offsetWidth / 2 + 4), hr.width - tip.offsetWidth / 2 - 4);
  tip.style.left = x + 'px';
}
function _tlHideTip(holder) { const t = holder && holder.querySelector('.tl-tip'); if (t) t.hidden = true; }
document.addEventListener('mouseover', e => {
  const col = e.target.closest && e.target.closest('.v2-timeline [data-tl-bucket]');
  if (col) _tlShowTip(col);
});
document.addEventListener('mouseout', e => {
  const col = e.target.closest && e.target.closest('.v2-timeline [data-tl-bucket]');
  if (col && !col.contains(e.relatedTarget)) _tlHideTip(col.closest('.tl-chart'));
});
document.addEventListener('focusin', e => {
  const col = e.target.closest && e.target.closest('.v2-timeline [data-tl-bucket]');
  if (col) _tlShowTip(col);
});
document.addEventListener('focusout', e => {
  const col = e.target.closest && e.target.closest('.v2-timeline [data-tl-bucket]');
  if (col) _tlHideTip(col.closest('.tl-chart'));
});

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
  if (segBtn) { _tlSave(rn, { [segBtn.parentElement.dataset.tlSet]: segBtn.dataset.v }); sec._tlAnim = true; _tlRenderOne(sec, rn); return; }
  if (e.target.closest('.tl-toggle')) {
    const o = _tlSave(rn, { closed: !_tlOpts(rn).closed });
    sec.classList.toggle('tl-closed', o.closed);
    sec.querySelector('.tl-body').hidden = o.closed;
    const b = sec.querySelector('.tl-toggle');
    b.textContent = o.closed ? '▸ Expandir' : '▾ Recolher';
    b.setAttribute('aria-expanded', String(!o.closed));
    sec._tlAnim = !o.closed;
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
  _tlSave(sec.dataset.tlReg, { area: sel.value }); sec._tlAnim = true; _tlRenderOne(sec, sec.dataset.tlReg);
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

