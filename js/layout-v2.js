/* ══════════════════════════════════════════════════════════════
   Layout v2 — painel compacto (notebook) + inbox lateral
   Substitui apenas a renderização do grid. Dados, modal, inbox
   e ferramentas continuam usando o código original.
   Alternância Novo/Clássico salva em localStorage ('sir_layout').
   ══════════════════════════════════════════════════════════════ */

const LS_LAYOUT   = 'sir_layout';      // 'v2' | 'classic'
const LS_V2_SCOPE = 'sir_v2_scope';    // 'all' | 'mine'

function _lsGet(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
function _lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function getLayout()  { return _lsGet(LS_LAYOUT, 'v2'); }
/* Com áreas salvas, o padrão é mostrar só elas (em qualquer aparelho) */
function getV2Scope() { return _lsGet(LS_V2_SCOPE, 'mine'); }

/* Ao aplicar "Minhas Áreas", o painel passa a mostrar só elas.
   As demais voltam quando você clicar em "Todas as áreas". */
if (typeof saveSettings === 'function') {
  const _saveSettingsOrig = saveSettings;
  saveSettings = function (onSaved) {
    return _saveSettingsOrig(function () {
      if (getUserSavedAreas().length) _lsSet(LS_V2_SCOPE, 'mine');
      if (onSaved) onSaved();
    });
  };
}

/* Lista de tickets em cartões: no layout novo (qualquer tela) e sempre no celular */
function useTicketCards() {
  const narrow = !!(window.matchMedia && matchMedia('(max-width: 640px)').matches);
  return getLayout() === 'v2' || narrow;
}
if (typeof openModal === 'function') {
  const _openModalOrig = openModal;
  openModal = function () {
    const ov = document.getElementById('modal-overlay');
    if (ov) ov.classList.toggle('v2-cards', useTicketCards());
    return _openModalOrig.apply(this, arguments);
  };
}

/* Guarda a renderização original para o modo clássico */
const _renderDashboardClassic = renderDashboard;

function _sev(v) {
  if (v >= 10) return 'crit';
  if (v >= 6)  return 'warn';
  if (v >= 1)  return 'ok';
  return 'zero';
}
function _sevTotal(v) {
  if (v > 49) return 'crit';
  if (v > 29) return 'warn';
  return 'ok';
}
function _q(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function _v2Cell(tk, cf, val, delta) {
  const isRal = tk === 'ral';
  const title = _q(_cfTitle(tk, cf));
  return `<button class="v2-cell v2-${_sev(val)}" onclick="openModal('${_q(cf)}',${isRal},'${title}')"
            title="${isRal ? 'RAL' : 'REC'} ${escapeHtml(cf)}">
    <span class="v2-cell-lbl">${isRal ? 'RAL' : 'REC'}</span>
    <span class="v2-cell-val animate-num" data-val="${val}">${val}</span>
    ${delta > 0 ? `<span class="v2-delta" title="Aumento desde a última atualização">+${delta}</span>` : ''}
  </button>`;
}

function _delta(tk, cf, val) {
  const p = appState.previousCounts[tk][cf];
  return (p === undefined || val <= p) ? 0 : val - p;
}

/* ── Card expandido: resumo por classificação ──
   Toque no título do card (ex.: "NO2") para abrir/fechar.
   Os cards abertos ficam salvos neste aparelho ('sir_v2_open'). */
const LS_V2_OPEN = 'sir_v2_open';
function _v2OpenSet() { try { return new Set(JSON.parse(localStorage.getItem(LS_V2_OPEN) || '[]')); } catch (e) { return new Set(); } }
function _v2SaveOpen(set) { _lsSet(LS_V2_OPEN, JSON.stringify([...set])); }

function _v2TagCounts(tk, cf) {
  const list = (modalData[tk] && modalData[tk][cf]) || [];
  const cnt = {};
  for (const item of list) {
    const k = ((appState.ticketStates[makeIdentity(tk, item)] || {}).eventColor);
    if (typeof getTicketTag === 'function' && getTicketTag(k)) cnt[k] = (cnt[k] || 0) + 1;
  }
  return (typeof TICKET_TAGS !== 'undefined' ? TICKET_TAGS : []).filter(t => cnt[t.key]).map(t => ({ t, n: cnt[t.key] }));
}
function _v2SumCol(tk, cf) {
  const rows = _v2TagCounts(tk, cf);
  const body = rows.length
    ? rows.map(({ t, n }) => `<div class="v2-sum-row" title="${escapeHtml(t.label)}"><i class="v2-sum-dot" style="background:${t.bg}"></i><span class="v2-sum-lbl">${escapeHtml(t.label)}</span><b class="v2-sum-n">${n}</b></div>`).join('')
    : '<div class="v2-sum-empty">Sem classificação</div>';
  return `<div class="v2-sum-col"><div class="v2-sum-h">${tk.toUpperCase()}</div>${body}</div>`;
}
function _v2SumHTML(cf) { return _v2SumCol('ral', cf) + _v2SumCol('rec', cf); }

/* Atualiza os resumos abertos (após classificar ou receber notas da equipe) */
function refreshV2Summaries() {
  document.querySelectorAll('#main-grid .v2-tile.v2-open').forEach(el => {
    const box = el.querySelector('.v2-sum');
    if (box) box.innerHTML = _v2SumHTML(el.dataset.cf);
  });
}
function toggleV2Tile(cf) {
  const set = _v2OpenSet();
  set.has(cf) ? set.delete(cf) : set.add(cf);
  _v2SaveOpen(set);
  const el = document.querySelector(`#main-grid .v2-tile[data-cf="${CSS.escape(cf)}"]`);
  if (!el) return;
  const open = set.has(cf);
  el.classList.toggle('v2-open', open);
  el.querySelector('.v2-tile-head').setAttribute('aria-expanded', open);
  const box = el.querySelector('.v2-sum');
  if (open) { box.innerHTML = _v2SumHTML(cf); box.hidden = false; } else { box.hidden = true; box.innerHTML = ''; }
}

function _v2Tile(cf, ralV, recV, mine) {
  const name = CF_NAMES[cf] || '';
  const open = _v2OpenSet().has(cf);
  return `<div class="v2-tile${mine ? ' v2-mine' : ''}${open ? ' v2-open' : ''}" data-cf="${escapeHtml(cf)}">
    <button type="button" class="v2-tile-head" data-v2toggle aria-expanded="${open}" title="Toque para ${open ? 'fechar' : 'ver'} o resumo por classificação">
      <span class="v2-tile-cf">${escapeHtml(cf)}</span>
      <span class="v2-tile-name">${escapeHtml(name)}</span>
      <i class="v2-chev" aria-hidden="true"></i>
    </button>
    <div class="v2-tile-cells">
      ${_v2Cell('ral', cf, ralV, _delta('ral', cf, ralV))}
      ${_v2Cell('rec', cf, recV, _delta('rec', cf, recV))}
    </div>
    <div class="v2-sum"${open ? '' : ' hidden'}>${open ? _v2SumHTML(cf) : ''}</div>
  </div>`;
}
document.addEventListener('click', e => {
  const h = e.target.closest && e.target.closest('#main-grid [data-v2toggle]');
  if (h) toggleV2Tile(h.closest('.v2-tile').dataset.cf);
});

function _v2Kpi(label, key, ralV, recV, accent) {
  return `<div class="v2-kpi${accent ? ' v2-kpi-accent' : ''}">
    <div class="v2-kpi-lbl">${escapeHtml(label)}</div>
    <div class="v2-kpi-vals">
      <button class="v2-kpi-btn v2-t-${_sevTotal(ralV)}" onclick="openModal('${_q(key)}',true,'${_q('RAL · ' + label)}')">
        <span class="v2-kpi-type">RAL</span><span class="animate-num" data-val="${ralV}">${ralV}</span>
      </button>
      <button class="v2-kpi-btn v2-t-${_sevTotal(recV)}" onclick="openModal('${_q(key)}',false,'${_q('REC · ' + label)}')">
        <span class="v2-kpi-type">REC</span><span class="animate-num" data-val="${recV}">${recV}</span>
      </button>
    </div>
  </div>`;
}

function _buildMyAreasModalData(areas) {
  ['ral', 'rec'].forEach(tk => {
    const arr = [];
    areas.forEach(cf => { if (modalData[tk][cf]) arr.push(...modalData[tk][cf]); });
    modalData[tk]['MY_AREAS_V2'] = arr;
  });
}

function renderDashboardV2(ralRes, ralR, recRes, recR, userSavedAreas) {
  const areas   = Array.isArray(userSavedAreas) ? userSavedAreas : [];
  const hasMine = areas.length > 0;
  const scope   = hasMine ? getV2Scope() : 'all';

  /* ── Faixa de totais ── */
  let kpiMine = '';
  if (hasMine) {
    _buildMyAreasModalData(areas);
    const fRal = getFlatCFData(ralR), fRec = getFlatCFData(recR);
    const mRal = areas.reduce((s, cf) => s + (fRal[cf] || 0), 0);
    const mRec = areas.reduce((s, cf) => s + (fRec[cf] || 0), 0);
    kpiMine = _v2Kpi('Minhas áreas', 'MY_AREAS_V2', mRal, mRec, true);
  }
  let kpis;
  if (scope === 'mine') {
    /* Só as suas áreas: totais das regiões ficam ocultos */
    kpis = kpiMine;
  } else {
    kpis = _v2Kpi('Total RRE', 'ALL', ralRes.total, recRes.total, false) + kpiMine;
    for (const rn of Object.keys(REGIONS))
      kpis += _v2Kpi(rn, rn, ralR[rn].total, recR[rn].total, false);
  }

  /* ── Regiões ── */
  let regions = '';
  for (const [rn, cfs] of Object.entries(REGIONS)) {
    let cfKeys = Object.keys(cfs);
    if (scope === 'mine') cfKeys = cfKeys.filter(cf => areas.includes(cf));
    if (!cfKeys.length) continue;
    const tiles = cfKeys.map(cf =>
      _v2Tile(cf, ralR[rn].items[cf] || 0, recR[rn].items[cf] || 0, hasMine && scope === 'all' && areas.includes(cf))
    ).join('');
    regions += `<section class="v2-region">
      <div class="v2-region-head">
        <span class="v2-region-name">${escapeHtml(rn)}</span>
        <span class="v2-region-count">${cfKeys.length} CF${cfKeys.length > 1 ? 's' : ''}</span>
      </div>
      <div class="v2-tiles">${tiles}</div>
    </section>`;
  }

  document.getElementById('main-grid').innerHTML =
    `<div class="v2-kpis${scope === 'mine' ? ' v2-kpis-mine' : ''}">${kpis}</div><div class="v2-regions">${regions}</div>`;

  document.querySelectorAll('#main-grid .animate-num').forEach(el => {
    const v = parseInt(el.getAttribute('data-val'), 10);
    if (isFirstLoad) { el.textContent = '0'; animateValue(el, 0, v, 700); }
  });

  renderV2Bar();
}

/* Substitui a função global usada por onDataReady() */
renderDashboard = function (ralRes, ralR, recRes, recR, userSavedAreas) {
  applyLayoutClass();
  if (getLayout() === 'classic')
    return _renderDashboardClassic(ralRes, ralR, recRes, recR, userSavedAreas);
  return renderDashboardV2(ralRes, ralR, recRes, recR, userSavedAreas);
};

/* ── Barra de controles (escopo + layout) ── */
function renderV2Bar() {
  const bar = document.getElementById('v2-bar');
  if (!bar) return;
  const layout  = getLayout();
  const hasMine = getUserSavedAreas().length > 0;
  const scope   = hasMine ? getV2Scope() : 'all';
  bar.innerHTML = `
    ${layout === 'v2' ? `<div class="v2-seg" role="group" aria-label="Escopo">
      <button class="${scope === 'all' ? 'on' : ''}" onclick="setV2Scope('all')">Todas as áreas</button>
      <button class="${scope === 'mine' ? 'on' : ''}" onclick="setV2Scope('mine')" ${hasMine ? '' : 'disabled title="Selecione suas áreas em Minhas Áreas"'}>Só minhas áreas</button>
    </div>
    <div class="v2-legend">
      <span><i class="v2-dot v2-dot-ok"></i>1–5</span>
      <span><i class="v2-dot v2-dot-warn"></i>6–9</span>
      <span><i class="v2-dot v2-dot-crit"></i>10+</span>
    </div>` : '<div></div>'}
    <div class="v2-seg" role="group" aria-label="Layout">
      <button class="${layout === 'v2' ? 'on' : ''}" onclick="setLayout('v2')">Layout novo</button>
      <button class="${layout === 'classic' ? 'on' : ''}" onclick="setLayout('classic')">Clássico</button>
    </div>`;
}

function _rerender() {
  if (typeof resetForReload === 'function') resetForReload();
  loadAll(getUserSavedAreas());
}

function setV2Scope(s) { _lsSet(LS_V2_SCOPE, s); _rerender(); }
function setLayout(l)  { _lsSet(LS_LAYOUT, l); applyLayoutClass(); _rerender(); }

function applyLayoutClass() {
  document.body.classList.toggle('layout-v2', getLayout() === 'v2');
}

/* Versão do app (aparece no rodapé — útil para conferir se o celular atualizou) */
const SIR_APP_VERSION = 'v29';

/* Botão "Minhas Áreas" dentro da grade de ferramentas (usado no celular/tablet).
   Assim todos os botões ficam na mesma grade, sem depender de truques de CSS. */
function _addAreasToToolGrid() {
  const bar = document.querySelector('#header-action-btns .tool-bar-grouped');
  if (!bar || bar.querySelector('.tool-areas-btn')) return;
  const b = document.createElement('button');
  b.className = 'tool-group-btn tool-areas-btn';
  b.type = 'button';
  b.title = 'Minhas Áreas';
  b.setAttribute('aria-label', 'Minhas Áreas');
  b.setAttribute('onclick', 'openSettings()');
  b.innerHTML = '<i data-lucide="layers"></i><span>Minhas Áreas</span>';
  bar.appendChild(b);
  bar.closest('.header-actions')?.classList.add('has-tool-areas');
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [b.querySelector('[data-lucide]')] });
}

/* O app sempre abre no topo, com os botões à vista */
try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
window.addEventListener('load', () => window.scrollTo(0, 0));

document.addEventListener('DOMContentLoaded', () => {
  applyLayoutClass(); renderV2Bar();

  /* Resumos abertos acompanham as classificações (sua e da equipe) */
  if (typeof persistTicketState === 'function') {
    const _pts = persistTicketState;
    persistTicketState = function () { const r = _pts.apply(this, arguments); setTimeout(refreshV2Summaries, 0); return r; };
  }
  if (typeof pullSharedNotes === 'function') {
    const _psn = pullSharedNotes;
    pullSharedNotes = function () { return Promise.resolve(_psn.apply(this, arguments)).finally(refreshV2Summaries); };
  }

  if (typeof renderToolbarButtons === 'function') {
    const _rtbOrig = renderToolbarButtons;
    renderToolbarButtons = function () { const r = _rtbOrig.apply(this, arguments); _addAreasToToolGrid(); return r; };
  }

  const footer = document.querySelector('.page-footer');
  if (footer && !document.getElementById('app-version')) {
    const v = document.createElement('span');
    v.id = 'app-version'; v.textContent = 'SIR ' + SIR_APP_VERSION;
    footer.insertBefore(v, footer.lastElementChild);
  }
});
