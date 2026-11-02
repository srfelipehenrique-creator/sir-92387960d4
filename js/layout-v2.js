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
function getV2Scope() { return _lsGet(LS_V2_SCOPE, 'all'); }

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

function _v2Tile(cf, ralV, recV, mine) {
  const name = CF_NAMES[cf] || '';
  return `<div class="v2-tile${mine ? ' v2-mine' : ''}">
    <div class="v2-tile-head">
      <span class="v2-tile-cf">${escapeHtml(cf)}</span>
      <span class="v2-tile-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
    </div>
    <div class="v2-tile-cells">
      ${_v2Cell('ral', cf, ralV, _delta('ral', cf, ralV))}
      ${_v2Cell('rec', cf, recV, _delta('rec', cf, recV))}
    </div>
  </div>`;
}

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
  let kpis = _v2Kpi('Total RRE', 'ALL', ralRes.total, recRes.total, false);
  if (hasMine) {
    _buildMyAreasModalData(areas);
    const mRal = areas.reduce((s, cf) => s + (ralR && getFlatCFData(ralR)[cf] || 0), 0);
    const mRec = areas.reduce((s, cf) => s + (recR && getFlatCFData(recR)[cf] || 0), 0);
    kpis += _v2Kpi('Minhas áreas', 'MY_AREAS_V2', mRal, mRec, true);
  }
  for (const rn of Object.keys(REGIONS))
    kpis += _v2Kpi(rn, rn, ralR[rn].total, recR[rn].total, false);

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
    `<div class="v2-kpis">${kpis}</div><div class="v2-regions">${regions}</div>`;

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

document.addEventListener('DOMContentLoaded', () => { applyLayoutClass(); renderV2Bar(); });
