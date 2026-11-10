/* ══════════════════════════════════════════════════════════════
   Classificação do ticket (bolinha de cor)
   - Clique na bolinha → lista com as 8 classificações (ordem da equipe)
   - A escolhida aparece como etiqueta colorida abaixo do SLA,
     pinta a bolinha e a faixa lateral do ticket
   - Compartilhada com todos (via notas da equipe — shared-notes.js)
   - Entra no texto copiado para WhatsApp com a bolinha da mesma cor
   ══════════════════════════════════════════════════════════════ */

const TICKET_TAGS = [
  { key: 'tratativa',         label: 'EQUIPE ACIONADA',    bg: '#4f8fd8', fg: '#ffffff', emoji: '🔵' },
  { key: 'transferir',        label: 'TRANSFERIR',         bg: '#c9bee0', fg: '#2b2140', emoji: '🟣' },
  { key: 'falha-concorrente', label: 'FALHA CONCORRENTE',  bg: '#f7cbaa', fg: '#5a2e10', emoji: '🟠' },
  { key: 'validacao',         label: 'VALIDAÇÃO',          bg: '#ffff00', fg: '#3a3500', emoji: '🟡' },
  { key: 'conjunta',          label: 'CONJUNTA',           bg: '#f79646', fg: '#3d1a00', emoji: '🟠' },
  { key: 'area-risco',        label: 'ÁREA DE RISCO',      bg: '#ff0000', fg: '#ffffff', emoji: '🔴' },
  { key: 'pend-encerramento', label: 'PEND. ENCERRAMENTO', bg: '#c4d79b', fg: '#24320a', emoji: '🟢' },
  { key: 'acesso',            label: 'ACESSO',             bg: '#963634', fg: '#ffffff', emoji: '🟤' },
];
function getTicketTag(key) { return TICKET_TAGS.find(t => t.key === key) || null; }

/* Desenha a classificação de uma linha/cartão */
function renderTicketTag(row) {
  if (!row) return;
  const tag = getTicketTag(row.dataset.eventColor);
  const dot = row.querySelector('.color-cycle-dot');
  if (dot) {
    dot.className = 'color-cycle-dot' + (tag ? ' ev-tag' : ' ev-none');
    dot.style.background  = tag ? tag.bg : '';
    dot.style.borderColor = tag ? tag.bg : '';
    dot.title = tag ? `${tag.label} — clique para alterar` : 'Clique para classificar';
  }
  if (tag) { row.style.setProperty('--tag-color', tag.bg); row.setAttribute('data-tag-on', ''); }
  else { row.style.removeProperty('--tag-color'); row.removeAttribute('data-tag-on'); }

  const sla = row.querySelector('td.sla-col');
  if (sla) {
    sla.querySelector('.tag-pill')?.remove();
    if (tag) {
      const pill = document.createElement('div');
      pill.className = 'tag-pill';
      pill.style.background = tag.bg;
      pill.style.color = tag.fg;
      pill.textContent = tag.label;
      pill.title = 'Clique para alterar a classificação';
      pill.addEventListener('click', e => showTagPicker(e, row));
      sla.appendChild(pill);
    }
  }
}
function renderAllTicketTags() {
  document.querySelectorAll('#modal-tbody tr.ticket-row').forEach(row => {
    /* Cores antigas (pessoais) que não são classificações → sem marcação */
    if (row.dataset.eventColor && row.dataset.eventColor !== 'none' && !getTicketTag(row.dataset.eventColor))
      row.dataset.eventColor = 'none';
    renderTicketTag(row);
  });
}

/* ── Lista de classificações ── */
function removeTagPicker() {
  const m = document.getElementById('tag-picker-popup');
  if (!m) return;
  if (m._cleanup) m._cleanup();
  m.remove();
}
function showTagPicker(e, row) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  removeTagPicker();
  if (typeof removeColorPicker === 'function') removeColorPicker();
  const current = row.dataset.eventColor || 'none';
  const menu = document.createElement('div');
  menu.id = 'tag-picker-popup';
  menu.className = 'tag-picker';
  menu.innerHTML =
    `<div class="tag-picker-head">Classificar ticket</div>` +
    TICKET_TAGS.map(t =>
      `<button type="button" class="tag-opt${t.key === current ? ' active' : ''}" data-key="${t.key}" style="background:${t.bg};color:${t.fg}">${t.label}</button>`
    ).join('') +
    `<button type="button" class="tag-opt tag-clear${current === 'none' ? ' active' : ''}" data-key="none">Sem classificação</button>`;
  document.body.appendChild(menu);

  /* Posição: perto da bolinha no PC; folha embaixo no celular */
  if (window.matchMedia && matchMedia('(max-width: 640px)').matches) {
    menu.classList.add('tag-sheet');
  } else {
    const src = (e && e.currentTarget && e.currentTarget.getBoundingClientRect) ? e.currentTarget.getBoundingClientRect()
              : row.getBoundingClientRect();
    const mw = 230, mh = menu.offsetHeight || 340;
    menu.style.left = Math.max(8, Math.min(src.left, innerWidth - mw - 8)) + 'px';
    menu.style.top  = Math.max(8, Math.min(src.bottom + 6, innerHeight - mh - 8)) + 'px';
  }

  menu.addEventListener('click', ev => {
    const b = ev.target.closest('.tag-opt');
    if (!b) return;
    ev.stopPropagation();
    const key = b.dataset.key;
    row.dataset.eventColor = key;
    renderTicketTag(row);
    persistTicketState(row.dataset.identity, { eventColor: key });
    if (typeof saveTableState === 'function')
      saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
    removeTagPicker();
  });
  const onClose = ev => { if (!menu.contains(ev.target)) removeTagPicker(); };
  const onKey   = ev => { if (ev.key === 'Escape') removeTagPicker(); };
  setTimeout(() => { document.addEventListener('click', onClose, true); document.addEventListener('contextmenu', onClose); }, 0);
  document.addEventListener('keydown', onKey);
  menu._cleanup = () => {
    document.removeEventListener('click', onClose, true);
    document.removeEventListener('contextmenu', onClose);
    document.removeEventListener('keydown', onKey);
  };
}

/* ── Substitui a bolinha antiga (cores pessoais) pela classificação ── */
document.addEventListener('DOMContentLoaded', () => {
  cycleEventColor = function (dot) { showTagPicker({ preventDefault() {}, stopPropagation() {}, currentTarget: dot }, dot.closest('tr')); };
  showColorPicker = function (e, row) { showTagPicker(e, row); };

  if (typeof applyTicketStatesToTbody === 'function') {
    const _apply = applyTicketStatesToTbody;
    applyTicketStatesToTbody = function () { const r = _apply.apply(this, arguments); renderAllTicketTags(); return r; };
  }
  /* Ordenar por classificação (na ordem da equipe; sem classificação por último) */
  if (typeof sortRowsArray === 'function') {
    const _sort = sortRowsArray;
    sortRowsArray = function (rows) {
      if (modalSortState.col !== 'tag') return _sort(rows);
      const rank = r => { const i = TICKET_TAGS.findIndex(t => t.key === r.dataset.eventColor); return i < 0 ? 99 : i; };
      rows.sort((a, b) => {
        const d = modalSortState.dir === 'asc' ? rank(a) - rank(b) : (rank(b) === 99 ? -1 : rank(a) === 99 ? 1 : rank(b) - rank(a));
        return d || (parseAbertura(b.dataset.abertura || '') - parseAbertura(a.dataset.abertura || ''));
      });
    };
  }
  if (typeof updateSlaCells === 'function') {
    const _sla = updateSlaCells;
    updateSlaCells = function () { const r = _sla.apply(this, arguments); renderAllTicketTags(); return r; };
  }
});
