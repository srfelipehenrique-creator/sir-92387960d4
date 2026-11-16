/* ══════════════════════════════════════════════════════════════
   Tela de tickets: abas RAL | REC | RAL Qualidade + Cards/Lista
   - As abas trocam o tipo mantendo a mesma área (CF, região, total,
     Minhas áreas ou Lixeira).
   - RAL Qualidade usa a mesma tela de RAL/REC: notas, classificação,
     status, copiar, associar, filtro e CSV funcionam igual. No lugar
     do prazo de SLA aparece há quantos dias a RAL está em tela.
   - Cards/Lista: escolha salva neste aparelho ('sir_ticket_view').
   ══════════════════════════════════════════════════════════════ */

const TRASH_KEY = 'LIXO';
function listBase(key) { return isQualKey(key) ? key.slice(QKEY.length) : String(key || ''); }
function listKind(key, isRal) { return isQualKey(key) ? 'qual' : (isRal ? 'ral' : 'rec'); }
function isTrashKey(key) { return listBase(key) === TRASH_KEY; }
function listKeyFor(kind, base) { return kind === 'qual' ? QKEY + base : base; }
function currentListKind() { return listKind(appState.currentModalKey, appState.currentModalType === 'ral'); }

let _listLast = null;   /* [chave, isRal, título] da lista aberta */

function openList(kind, base) {
  openModal(listKeyFor(kind, base), kind !== 'rec', listTitle(kind, base));
}

function _listBar() {
  let bar = document.getElementById('list-bar');
  if (bar) return bar;
  const fb = document.getElementById('modal-filter-bar');
  if (!fb) return null;
  bar = document.createElement('div');
  bar.id = 'list-bar'; bar.className = 'list-bar';
  fb.parentNode.insertBefore(bar, fb);
  bar.addEventListener('click', e => {
    const t = e.target.closest('[data-kind]');
    if (t) { if (!t.classList.contains('on')) openList(t.dataset.kind, listBase(appState.currentModalKey)); return; }
    const v = e.target.closest('[data-view]');
    if (v && !v.classList.contains('on')) {
      setTicketView(v.dataset.view);
      if (typeof saveTableState === 'function')
        saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
      if (_listLast) openModal(..._listLast);
    }
  });
  return bar;
}

function renderListBar() {
  const bar = _listBar();
  if (!bar) return;
  const key = appState.currentModalKey, base = listBase(key), kind = currentListKind();
  const hasTabs = modalData.ral[QKEY + base] !== undefined;
  const n = { ral: (modalData.ral[base] || []).length, rec: (modalData.rec[base] || []).length, qual: (modalData.ral[QKEY + base] || []).length };
  const tab = (k, label) => `<button type="button" role="tab" data-kind="${k}" class="${kind === k ? 'on' : ''}" aria-selected="${kind === k}"><span class="lt-label">${label}</span> <b>${n[k]}</b></button>`;
  const view = getTicketView();
  bar.innerHTML =
    (hasTabs ? `<div class="v2-seg list-tabs" role="tablist" aria-label="Tipo de ticket">${tab('ral', 'RAL')}${tab('rec', 'REC')}${tab('qual', '<span class="lt-long">RAL </span>Qualidade')}</div>` : '<span></span>') +
    `<span class="list-bar-extra" id="list-bar-extra"></span>` +
    `<div class="v2-seg list-view" role="group" aria-label="Exibir tickets como">
       <button type="button" data-view="cards" class="${view === 'cards' ? 'on' : ''}" title="Exibir os tickets em cards">Cards</button>
       <button type="button" data-view="list" class="${view === 'list' ? 'on' : ''}" title="Exibir os tickets em lista">Lista</button>
     </div>`;
  const th = document.querySelector('#modal-overlay th.sla-col');
  if (th) th.textContent = isTrashKey(key) ? 'Saída' : kind === 'qual' ? 'Em tela' : 'Prazo SLA';
  document.dispatchEvent(new CustomEvent('sir-list-bar', { detail: { key, base, kind } }));
}

function qualDaysBadge(abertura) {
  const d = typeof calcDiasEmTela === 'function' ? calcDiasEmTela(abertura) : 0;
  return `<span class="sla-badge sla-days${d >= 7 ? ' sla-days-crit' : ''}" title="Há ${d} dia${d === 1 ? '' : 's'} em tela">${d} dia${d === 1 ? '' : 's'}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
  /* Qualidade: dias em tela no lugar do prazo de SLA */
  const _sla = buildSlaCellHTML;
  buildSlaCellHTML = function (abertura) {
    if (isQualKey(appState.currentModalKey)) return qualDaysBadge(abertura);
    return _sla.apply(this, arguments);
  };

  /* Texto copiado de uma RAL de Qualidade: dias em tela no lugar do SLA */
  const _fmt = formatTicketWA;
  formatTicketWA = function (item) {
    const t = _fmt.apply(this, arguments);
    if (!item || item.extra !== 'QUALIDADE') return t;
    const d = typeof calcDiasEmTela === 'function' ? calcDiasEmTela(item.abertura) : 0;
    return t.split('\n').map(l => l.startsWith('⏳ SLA:') ? `📆 Em tela há ${d} dia${d === 1 ? '' : 's'}` : l).join('\n');
  };

  const _open = openModal;
  openModal = function (dataKey, isRal, title) {
    _listLast = [dataKey, isRal, title];
    const ov = document.getElementById('modal-overlay');
    if (ov) { ov.classList.toggle('is-qual', isQualKey(dataKey)); ov.classList.toggle('trash-ro', isTrashKey(dataKey)); }
    const r = _open.apply(this, arguments);
    /* Com a tela já aberta: redesenha notas, classificações e (na lixeira) a hora da saída */
    if (typeof _snRefreshOpenModal === 'function') _snRefreshOpenModal();
    renderListBar();
    return r;
  };
});
