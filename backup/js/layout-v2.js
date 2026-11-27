/* ══════════════════════════════════════════════════════════════
   Layout v2 — painel compacto (notebook) + inbox lateral
   Substitui apenas a renderização do grid. Dados, modal, inbox
   e ferramentas continuam usando o código original.
   Alternância Painel/Grafana (antes Novo/Clássico) salva em localStorage ('sir_layout').
   ══════════════════════════════════════════════════════════════ */


/* v67: preferências lidas e gravadas pelo SirStore (js/store.js) */
function getLayout()  { return SirStore.get('layout'); }
/* Com áreas salvas, o padrão é mostrar só elas (em qualquer aparelho) */
function getV2Scope() { return SirStore.get('scope'); }

/* Ao aplicar "Minhas Áreas", o painel passa a mostrar só elas.
   As demais voltam quando você clicar em "Todas as áreas". */
if (typeof saveSettings === 'function') {
  const _saveSettingsOrig = saveSettings;
  saveSettings = function (onSaved) {
    return _saveSettingsOrig(function () {
      if (getUserSavedAreas().length) SirStore.set('scope', 'mine');
      if (onSaved) onSaved();
    });
  };
}

/* Lista de tickets em cartões ou em lista (tabela).
   Você escolhe na própria tela de tickets ('sir_ticket_view'); sem escolha,
   vale o padrão: cartões no layout novo e no celular. */
function getTicketView() {
  const v = SirStore.get('ticketView');
  if (v === 'cards' || v === 'list') return v;
  const narrow = !!(window.matchMedia && matchMedia('(max-width: 640px)').matches);
  return (getLayout() === 'v2' || narrow) ? 'cards' : 'list';
}
function setTicketView(v) { SirStore.set('ticketView', v === 'list' ? 'list' : 'cards'); }
function useTicketCards() { return getTicketView() === 'cards'; }
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

/* v69: cores e escape ficam nos componentes (js/componentes/celula.js) */
const _sev = SirUI.sevCF, _sevTotal = SirUI.sevTotal, _q = SirUI.js;

function _v2Cell(tk, cf, val, delta) {
  return SirUI.celula({ tipo: tk, cf, valor: val, delta, titulo: _cfTitle(tk, cf) });
}

/* ── RALs de Qualidade por área ──
   Ficam em modalData.ral com a chave 'Q:<área>' (ex.: 'Q:BX1', 'Q:ALL'),
   assim a tela de tickets é a mesma de RAL/REC: notas, classificação,
   status, copiar, associar, filtro e CSV funcionam igual. */
const QKEY = 'Q:';
function isQualKey(k) { return typeof k === 'string' && k.startsWith(QKEY); }
function _isCfKey(k) { return Object.values(REGIONS).some(cfs => k in cfs); }
function _qualAll() {
  return (typeof qualidadeItems !== 'undefined' ? qualidadeItems : []).map(i => ({
    ticket: i.ticket, designacao: i.designacao, extra: 'QUALIDADE', cfOrigem: i.cfOrigem, abertura: i.abertura || ''
  }));
}
function buildQualModalData(areas) {
  const all = _qualAll();
  const by = cfs => all.filter(i => cfs.includes(i.cfOrigem));
  for (const [rn, cfs] of Object.entries(REGIONS)) {
    const keys = Object.keys(cfs);
    keys.forEach(cf => { modalData.ral[QKEY + cf] = by([cf]); });
    modalData.ral[QKEY + rn] = by(keys);
  }
  modalData.ral[QKEY + 'ALL'] = all;
  modalData.ral[QKEY + 'MY_AREAS_V2'] = by(Array.isArray(areas) ? areas : []);
}
function qualCount(key) { return (modalData.ral[QKEY + key] || []).length; }

/* Título da tela de tickets para cada tipo (ral | rec | qual) e área */
function listTitle(kind, base) {
  if (_isCfKey(base)) {
    if (kind !== 'qual') return _cfTitle(kind, base);
    const name = CF_NAMES[base];
    return `RAL's de Qualidade em tela no CF ${base}${name ? ' - ' + name : ''}`;
  }
  const label = base === 'ALL' ? 'Total RRE' : base === 'MY_AREAS_V2' ? 'Minhas áreas' : base;
  return `${kind === 'qual' ? 'RAL Qualidade' : kind.toUpperCase()} · ${label}`;
}

function _v2QCell(cf) {
  return SirUI.celulaQual({ cf, valor: qualCount(cf), chave: QKEY + cf, titulo: listTitle('qual', cf) });
}

function _delta(tk, cf, val) {
  const p = appState.previousCounts[tk][cf];
  return (p === undefined || val <= p) ? 0 : val - p;
}

/* ── Card expandido: resumo por classificação ──
   Toque no título do card (ex.: "NO2" ou "Minhas áreas") para abrir/fechar.
   Os cards abertos ficam salvos neste aparelho ('sir_v2_open').
   Card aberto ganha o botão de copiar o resumo (mensagem com emojis). */
const V2_MY = 'MY_AREAS_V2';
function _v2OpenSet() { return new Set(SirStore.get('openCards')); }
function _v2SaveOpen(set) { SirStore.set('openCards', [...set]); }

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

function _v2CopyBtn() { return SirUI.botaoCopiar(); }

/* ── Texto do resumo para WhatsApp (o mesmo que aparece no card) ── */
function _v2SumLines(tk, cf) {
  const n = ((modalData[tk] && modalData[tk][cf]) || []).length;
  const rows = _v2TagCounts(tk, cf);
  const L = [`${tk === 'ral' ? '📕' : '📗'} *${tk.toUpperCase()}* (${n} ticket${n === 1 ? '' : 's'})`];
  if (rows.length) rows.forEach(({ t, n }) => L.push(`${t.emoji} ${t.label}: *${n}*`));
  else L.push('▫️ Sem classificação');
  return L;
}
function v2SummaryText(cf) {
  const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  if (cf !== V2_MY) {
    const name = CF_NAMES[cf] || '';
    return [`📊 *RESUMO ${cf}*${name ? ` — ${name}` : ''}`, `🕒 ${now}`, '',
            ..._v2SumLines('ral', cf), '', ..._v2SumLines('rec', cf)].join('\n');
  }
  /* Minhas áreas: 1 mensagem com o total e cada área separada */
  const areas = getUserSavedAreas();
  const L = [`📊 *RESUMO — MINHAS ÁREAS*`, `🕒 ${now}`, '', '🧮 *TOTAL*', ..._v2SumLines('ral', V2_MY), ..._v2SumLines('rec', V2_MY)];
  for (const a of areas) {
    const name = CF_NAMES[a] || '';
    L.push('', '━━━━━━━━━━', `📍 *${a}*${name ? ` — ${name}` : ''}`, ..._v2SumLines('ral', a), ..._v2SumLines('rec', a));
  }
  return L.join('\n');
}
async function copyV2Summary(cf, btn) {
  const text = v2SummaryText(cf);
  const ok = typeof _waWrite === 'function' ? await _waWrite(text)
    : await navigator.clipboard.writeText(text).then(() => true, () => false);
  if (btn) { btn.classList.toggle('done', ok); setTimeout(() => btn.classList.remove('done'), 1500); }
  if (typeof showActionToast === 'function')
    showActionToast(ok ? `Resumo ${cf === V2_MY ? 'de Minhas áreas' : cf} copiado — cole na conversa` : 'Não foi possível copiar', ok ? 'success' : 'error');
}

function _v2CardEl(cf) { return document.querySelector(`#main-grid [data-v2card][data-cf="${CSS.escape(cf)}"]`); }
/* Atualiza os resumos abertos (após classificar ou receber notas da equipe) */
function refreshV2Summaries() {
  document.querySelectorAll('#main-grid [data-v2card].v2-open').forEach(el => {
    const box = el.querySelector('.v2-sum');
    if (box) box.innerHTML = _v2SumHTML(el.dataset.cf);
  });
}
function toggleV2Tile(cf) {
  const set = _v2OpenSet();
  set.has(cf) ? set.delete(cf) : set.add(cf);
  _v2SaveOpen(set);
  const el = _v2CardEl(cf);
  if (!el) return;
  const open = set.has(cf);
  el.classList.toggle('v2-open', open);
  el.querySelector('[data-v2toggle]').setAttribute('aria-expanded', open);
  const box = el.querySelector('.v2-sum');
  if (open) { box.innerHTML = _v2SumHTML(cf); box.hidden = false; } else { box.hidden = true; box.innerHTML = ''; }
}

/* v69: só reúne os dados (props) e chama o componente (js/componentes/card-cf.js) */
function _v2Tile(cf, ralV, recV, mine) {
  const aberto = _v2OpenSet().has(cf);
  return SirUI.cardCF({
    cf, nome: CF_NAMES[cf] || '', minha: !!mine, aberto,
    resumoHTML: aberto ? _v2SumHTML(cf) : '',
    ral:  { valor: ralV, delta: _delta('ral', cf, ralV), titulo: _cfTitle('ral', cf) },
    rec:  { valor: recV, delta: _delta('rec', cf, recV), titulo: _cfTitle('rec', cf) },
    qual: { valor: qualCount(cf), chave: QKEY + cf, titulo: listTitle('qual', cf) },
  });
}
document.addEventListener('click', e => {
  if (!e.target.closest) return;
  const c = e.target.closest('#main-grid [data-v2copy]');
  if (c) { copyV2Summary(c.closest('[data-v2card]').dataset.cf, c); return; }
  const h = e.target.closest('#main-grid [data-v2toggle]');
  if (h) toggleV2Tile(h.closest('[data-v2card]').dataset.cf);
});

/* v69: só reúne os dados (props) e chama o componente (js/componentes/card-total.js) */
function _v2Kpi(label, key, ralV, recV, accent) {
  const expansivel = key === V2_MY;   /* só o card "Minhas áreas" expande */
  const aberto = expansivel && _v2OpenSet().has(V2_MY);
  return SirUI.cardTotal({
    rotulo: label, chave: key, destaque: !!accent, expansivel, aberto, idCard: V2_MY,
    resumoHTML: aberto ? _v2SumHTML(V2_MY) : '',
    ral:  { valor: ralV, titulo: 'RAL · ' + label },
    rec:  { valor: recV, titulo: 'REC · ' + label },
    qual: { valor: qualCount(key), chave: QKEY + key, titulo: listTitle('qual', key) },
  });
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
    kpiMine = _v2Kpi('Minhas áreas', V2_MY, mRal, mRec, true);
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
    /* Cada grupo traz o seu gráfico (RAL e REC das áreas do grupo) e o botão de encolher */
    const hasCharts = typeof _v2RegionChartsShell === 'function';
    regions += SirUI.grupo({
      nome: rn, qtdCFs: cfKeys.length, cardsHTML: tiles,
      botaoGraficoHTML: hasCharts ? _v2RegionToggleBtn(rn) : '',
      graficosHTML: hasCharts ? _v2RegionChartsShell(rn) : '',
    });
  }

  /* v67: na primeira vez desenha tudo; depois só altera o que mudou (js/morph.js).
     A Linha do Tempo, logo abaixo, é mantida e atualizada pelo próprio código dela. */
  const grid  = document.getElementById('main-grid');
  const kHtml = `<div class="v2-kpis${scope === 'mine' ? ' v2-kpis-mine' : ''}">${kpis}</div>`;
  const rHtml = `<div class="v2-regions">${regions}</div>`;
  const oldK = grid.querySelector(':scope > .v2-kpis'), oldR = grid.querySelector(':scope > .v2-regions');
  if (oldK && oldR && typeof sirMorphEl === 'function') { sirMorphEl(oldK, kHtml); sirMorphEl(oldR, rHtml); }
  else grid.innerHTML = kHtml + rHtml;

  document.querySelectorAll('#main-grid .animate-num').forEach(el => {
    const v = parseInt(el.getAttribute('data-val'), 10);
    if (isFirstLoad) { el.textContent = '0'; animateValue(el, 0, v, 700); }
  });

  renderV2Bar();
}

/* Substitui a função global usada por onDataReady() */
renderDashboard = function (ralRes, ralR, recRes, recR, userSavedAreas) {
  applyLayoutClass();
  buildQualModalData(userSavedAreas);
  if (getLayout() === 'classic')
    return _renderDashboardClassic(ralRes, ralR, recRes, recR, userSavedAreas);
  return renderDashboardV2(ralRes, ralR, recRes, recR, userSavedAreas);
};

/* ── Controles do painel ──
   Escopo (Todas as áreas / Só minhas): na barra de cima, ao lado de "SIR".
   Layout (Painel / Grafana): dentro do menu lateral (☰).
   A legenda de cores (1–5 · 6–9 · 10+) fica só dentro dos gráficos. */
function renderV2Bar() {
  const layout  = getLayout();
  const hasMine = getUserSavedAreas().length > 0;
  const scope   = hasMine ? getV2Scope() : 'all';

  const bar = document.getElementById('v2-bar');
  if (bar) bar.innerHTML = '';

  const hs = document.getElementById('hdr-scope');
  if (hs) {
    if (layout !== 'v2') { hs.innerHTML = ''; hs.hidden = true; }
    else {
      hs.hidden = false;
      const opt = (val, lbl) => `<button type="button" class="hdr-scope-opt${scope === val ? ' on' : ''}"
          aria-pressed="${scope === val}" onclick="setV2Scope('${val}')" ${!hasMine ? 'disabled' : ''}>${lbl}</button>`;
      hs.innerHTML = `<div class="hdr-scope-grp${hasMine ? '' : ' dis'}" role="group" aria-label="Áreas exibidas"${hasMine ? '' : ' title="Selecione suas áreas em Minhas Áreas"'}>
          ${opt('all', 'Todas as áreas')}<span class="hdr-scope-sep" aria-hidden="true">|</span>${opt('mine', 'Só minhas')}
        </div>`;
    }
  }

  const ml = document.getElementById('menu-layout');
  if (ml) {
    const opt = (val, lbl, icon) => `<button type="button" class="menu-layout-opt${layout === val ? ' on' : ''}"
        aria-pressed="${layout === val}" onclick="setLayout('${val}')">
        <i data-lucide="${icon}"></i><span>${lbl}</span>${layout === val ? '<i data-lucide="check" class="menu-layout-check"></i>' : ''}</button>`;
    ml.innerHTML = `<div class="menu-layout-title">Layout</div>
      ${opt('v2', 'Painel', 'layout-dashboard')}
      ${opt('classic', 'Grafana', 'bar-chart-3')}`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(ml.querySelectorAll('[data-lucide]')) });
  }
}

function _rerender() {
  if (typeof resetForReload === 'function') resetForReload();
  loadAll(getUserSavedAreas());
}

function setV2Scope(s) { SirStore.set('scope', s); _rerender(); }
function setLayout(l)  { SirStore.set('layout', l); applyLayoutClass(); _rerender(); }

function applyLayoutClass() {
  document.body.classList.toggle('layout-v2', getLayout() === 'v2');
}

/* Versão do app (aparece no rodapé — útil para conferir se o celular atualizou) */
const SIR_APP_VERSION = 'v101';
/* v70: mesma base de código nas duas versões; a de testes fica na pasta /backup/ */
const SIR_IS_BACKUP = /\/backup\//.test(location.pathname);

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
  /* Lixeira ao lado de Minhas Áreas */
  const t = document.createElement('button');
  t.className = 'tool-group-btn tool-areas-btn tool-trash-btn';
  t.type = 'button';
  t.title = 'Lixeira — tickets que saíram da tela';
  t.setAttribute('aria-label', 'Lixeira');
  t.setAttribute('onclick', 'openTrash()');
  t.innerHTML = '<i data-lucide="trash-2"></i><span>Lixeira</span><b class="trash-count" hidden></b>';
  bar.appendChild(t);
  bar.closest('.header-actions')?.classList.add('has-tool-areas');
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [b.querySelector('[data-lucide]'), t.querySelector('[data-lucide]')] });
  if (typeof updateTrashBadge === 'function') updateTrashBadge();
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
    if (SIR_IS_BACKUP) v.insertAdjacentHTML('beforeend', ' <b class="sir-backup-tag" title="Versão backup — onde as mudanças são testadas antes de ir para a principal">BACKUP</b>');
    footer.insertBefore(v, footer.lastElementChild);
  }
});
