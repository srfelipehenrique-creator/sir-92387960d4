/* ══════════════════════════════════════════════════════════════
   Lixeira — tickets que saíram da tela dos CFs
   - A cada atualização compara a tela atual com a anterior: o ticket
     (RAL, REC ou RAL de Qualidade) que sumiu vai para a lixeira com as
     notas, a classificação e o status que tinha naquele momento.
   - Abre pelo botão da lixeira ao lado de "Minhas Áreas", na mesma tela
     de tickets (cards ou lista), só para consulta: não dá para adicionar,
     editar ou excluir notas, nem mudar classificação/status. Só copiar.
   - Cada ticket é apagado 24 horas depois de entrar na lixeira.
     Se o ticket voltar para a tela, sai da lixeira.
   - Fica guardada neste aparelho ('sir_trash_v1').
   ══════════════════════════════════════════════════════════════ */

const LS_TRASH       = 'sir_trash_v1';
const LS_TRASH_LAST  = 'sir_trash_last_v1';
const LS_TRASH_SCOPE = 'sir_trash_scope';     // 'mine' | 'all'
const TRASH_TTL      = 24 * 3600 * 1000;

let _trash = [];          /* [{ id, tk: 'ral'|'rec'|'qual', item, st, at }] */
let _trashBlocked = 0;

function _trashRead(k, d) { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
function _trashWrite(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function _trashSave() { _trashWrite(LS_TRASH, _trash); }
function _trashPurge() {
  const cut = Date.now() - TRASH_TTL, n = _trash.length;
  _trash = _trash.filter(e => e && e.id && e.item && e.at > cut);
  if (_trash.length !== n) _trashSave();
}
function _trashLoad() { const v = _trashRead(LS_TRASH, []); _trash = Array.isArray(v) ? v : []; _trashPurge(); }
function _trashSlim(i) { return { ticket: i.ticket, designacao: i.designacao, extra: i.extra, cfOrigem: i.cfOrigem, abertura: i.abertura || '' }; }
function _trashIdTk(tk) { return tk === 'rec' ? 'rec' : 'ral'; }

/* Tudo o que está em tela agora: identidade → { tk, item } */
function _trashCurrent() {
  const cur = new Map();
  ['ral', 'rec'].forEach(tk => (modalData[tk]['ALL'] || []).forEach(i => cur.set(makeIdentity(tk, i), { tk, item: _trashSlim(i) })));
  _qualAll().forEach(i => cur.set(makeIdentity('ral', i), { tk: 'qual', item: i }));
  return cur;
}

function trashTrack() {
  const cur = _trashCurrent();
  if (!cur.size) return;                       /* fonte vazia ou com erro: não mexe */
  const prev = _trashRead(LS_TRASH_LAST, null);
  if (prev && typeof prev === 'object') {
    const ids = Object.keys(prev), gone = ids.filter(id => !cur.has(id));
    /* Mais da metade sumiu de uma vez: pode ser um arquivo incompleto. Espera
       duas atualizações seguidas antes de aceitar. */
    if (ids.length >= 30 && gone.length > ids.length * 0.5 && _trashBlocked < 2) { _trashBlocked++; return; }
    _trashBlocked = 0;
    const have = new Set(_trash.map(e => e.id)), now = Date.now();
    gone.forEach(id => {
      if (have.has(id) || !prev[id] || !prev[id].item) return;
      const st = appState.ticketStates[id];
      _trash.push({ id, tk: prev[id].tk, item: prev[id].item, st: st ? JSON.parse(JSON.stringify(st)) : null, at: now });
    });
  }
  _trash = _trash.filter(e => !cur.has(e.id));   /* voltou para a tela */
  _trashPurge();
  _trashSave();
  const last = {};
  cur.forEach((v, id) => { last[id] = v; });
  _trashWrite(LS_TRASH_LAST, last);
}

function trashScope() {
  const hasMine = getUserSavedAreas().length > 0;
  if (!hasMine) return 'all';
  try { return localStorage.getItem(LS_TRASH_SCOPE) === 'all' ? 'all' : 'mine'; } catch (e) { return 'mine'; }
}
function _trashVisible() {
  const areas = getUserSavedAreas();
  return trashScope() === 'mine' ? _trash.filter(e => areas.includes(e.item.cfOrigem)) : _trash;
}
function trashEntry(id) { return _trash.find(e => e.id === id) || null; }

/* Listas da lixeira para a tela de tickets (chave 'LIXO') */
function buildTrashModalData() {
  const list = _trashVisible();
  modalData.ral[TRASH_KEY] = list.filter(e => e.tk === 'ral').map(e => e.item);
  modalData.rec[TRASH_KEY] = list.filter(e => e.tk === 'rec').map(e => e.item);
  modalData.ral[QKEY + TRASH_KEY] = list.filter(e => e.tk === 'qual').map(e => e.item);
  /* Notas, classificação e status de quando o ticket saiu */
  list.forEach(e => { if (e.st && !appState.ticketStates[e.id]) appState.ticketStates[e.id] = { ...e.st, ts: Date.now() }; });
}

function updateTrashBadge() {
  const n = _trashVisible().length;
  document.querySelectorAll('.trash-count').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.hidden = !n; });
}

function trashModeActive() {
  const ov = document.getElementById('modal-overlay');
  return !!(ov && ov.classList.contains('active') && isTrashKey(appState.currentModalKey));
}

function openTrash(kind) {
  _trashPurge();
  buildTrashModalData();
  updateTrashBadge();
  const n = { ral: modalData.ral[TRASH_KEY].length, rec: modalData.rec[TRASH_KEY].length, qual: modalData.ral[QKEY + TRASH_KEY].length };
  const k = kind || ['ral', 'rec', 'qual'].find(x => n[x]) || 'ral';
  openList(k, TRASH_KEY);
}

function _trashWhen(ts) {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}
function _trashLeft(at) {
  const ms = Math.max(0, at + TRASH_TTL - Date.now());
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/* Em cada ticket da lixeira: quando saiu e quando será apagado */
function trashDecorate() {
  if (!trashModeActive()) return;
  const tb = document.getElementById('modal-tbody');
  if (!tb) return;
  tb.querySelectorAll('tr.ticket-row').forEach(row => {
    const e = trashEntry(row.dataset.identity), cell = row.querySelector('td.sla-col');
    if (!e || !cell) return;
    let m = cell.querySelector('.trash-meta');
    if (!m) { m = document.createElement('div'); m.className = 'trash-meta'; const b = cell.querySelector('.sla-badge'); if (b) b.insertAdjacentElement('afterend', m); else cell.prepend(m); }
    m.innerHTML = `${_trashWhen(e.at)}<br>apaga em ${_trashLeft(e.at)}`;
    m.title = 'Quando saiu da tela e em quanto tempo será apagado da lixeira';
  });
  const empty = tb.querySelector('.empty-state');
  if (empty) empty.textContent = 'Nenhum ticket deste tipo saiu da tela nas últimas 24 horas.';
}

document.addEventListener('DOMContentLoaded', () => {
  _trashLoad();
  updateTrashBadge();

  /* Detecta as saídas a cada atualização (não vale para o modo offline) */
  const _odr = onDataReady;
  onDataReady = function (ralRes, recRes, ralText, recText) {
    const r = _odr.apply(this, arguments);
    try {
      if (ralText && recText) trashTrack();
      buildTrashModalData();
      updateTrashBadge();
    } catch (e) { console.warn('lixeira:', e && e.message); }
    return r;
  };

  const _lt = listTitle;
  listTitle = function (kind, base) {
    if (base !== TRASH_KEY) return _lt.apply(this, arguments);
    return `Lixeira · ${kind === 'qual' ? 'RAL Qualidade' : kind.toUpperCase()} — saíram da tela nas últimas 24h`;
  };

  /* No lugar do SLA: "Saiu da tela" */
  const _sla = buildSlaCellHTML;
  buildSlaCellHTML = function () {
    if (isTrashKey(appState.currentModalKey)) return '<span class="sla-badge sla-out" title="Saiu da tela">Saiu</span>';
    return _sla.apply(this, arguments);
  };
  const _rat = renderAllTicketTags;
  renderAllTicketTags = function () { const r = _rat.apply(this, arguments); trashDecorate(); return r; };
  const _vt = vtRender;
  vtRender = function () { const r = _vt.apply(this, arguments); trashDecorate(); return r; };

  /* Somente leitura: nada de notas, classificação, status ou associação */
  const _no = notesOp;
  notesOp = function () { if (trashModeActive()) return Promise.resolve(); return _no.apply(this, arguments); };
  const _pts = persistTicketState;
  persistTicketState = function () { if (trashModeActive()) return; return _pts.apply(this, arguments); };
  const ov = document.getElementById('modal-overlay');
  if (ov) ov.addEventListener('contextmenu', e => { if (trashModeActive()) { e.stopPropagation(); } }, true);

  /* Texto copiado: como o ticket estava ao sair, com a hora da saída no lugar do SLA */
  const _fmt = formatTicketWA;
  formatTicketWA = function (item, isRal) {
    const t = _fmt.apply(this, arguments);
    if (!trashModeActive() || !item) return t;
    const e = trashEntry(makeIdentity(isRal ? 'ral' : 'rec', item));
    if (!e) return t;
    const out = `✅ Saiu da tela: ${_trashWhen(e.at)}`;
    let done = false;
    const L = t.split('\n').map(l => (l.startsWith('⏳ SLA:') || l.startsWith('📆 Em tela')) ? (done = true, out) : l);
    if (!done) L.push(out);
    return L.join('\n');
  };

  /* Barra da tela de tickets: escopo (Minhas áreas / Todas) e aviso de somente leitura */
  document.addEventListener('sir-list-bar', ev => {
    const box = document.getElementById('list-bar-extra');
    if (!box || ev.detail.base !== TRASH_KEY) return;
    const hasMine = getUserSavedAreas().length > 0, sc = trashScope();
    box.innerHTML =
      (hasMine ? `<div class="v2-seg trash-scope" role="group" aria-label="Áreas">
         <button type="button" data-tscope="mine" class="${sc === 'mine' ? 'on' : ''}">Minhas áreas</button>
         <button type="button" data-tscope="all" class="${sc === 'all' ? 'on' : ''}">Todas</button>
       </div>` : '') +
      `<span class="trash-note">Somente consulta e cópia · cada ticket é apagado 24h depois de sair</span>`;
  });
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#list-bar [data-tscope]');
    if (!b || b.classList.contains('on')) return;
    try { localStorage.setItem(LS_TRASH_SCOPE, b.dataset.tscope); } catch (err) {}
    openTrash(currentListKind());
  });

  setInterval(() => { _trashPurge(); updateTrashBadge(); if (trashModeActive()) trashDecorate(); }, 60000);
});
