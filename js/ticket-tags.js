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
  const onKey   = ev => { if (ev.key === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); removeTagPicker(); } };
  setTimeout(() => { document.addEventListener('click', onClose, true); document.addEventListener('contextmenu', onClose); }, 0);
  window.addEventListener('keydown', onKey, true);
  menu._cleanup = () => {
    document.removeEventListener('click', onClose, true);
    document.removeEventListener('contextmenu', onClose);
    window.removeEventListener('keydown', onKey, true);
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

/* ══════════════════════════════════════════════════════════════
   Filtro por classificação (na linha "Ordenar:") + Copiar selecionados
   - Marque uma ou mais classificações: só esses tickets aparecem
   - Nada marcado: tudo aparece normalmente
   - "Copiar selecionados": texto só dos tickets das classificações marcadas
   ══════════════════════════════════════════════════════════════ */
const tagFilter = new Set();    /* chaves marcadas ('none' = sem classificação) */

function _tfLabel() {
  if (!tagFilter.size) return 'Classificação';
  if (tagFilter.size === 1) { const k = [...tagFilter][0]; return k === 'none' ? 'Sem classificação' : (getTicketTag(k)?.label || k); }
  return `Classificação (${tagFilter.size})`;
}
function _tfButton() {
  let b = document.getElementById('tag-filter-btn');
  if (!b) {
    b = document.createElement('button');
    b.type = 'button'; b.id = 'tag-filter-btn'; b.className = 'tag-filter-btn';
    b.addEventListener('click', e => { e.stopPropagation(); toggleTagFilterMenu(b); });
  }
  b.innerHTML = `<span class="tf-dots">${[...tagFilter].filter(k => k !== 'none').slice(0, 4).map(k => `<i style="background:${getTicketTag(k).bg}"></i>`).join('')}</span><span class="tf-text">${escapeHtml(_tfLabel())}</span><span class="tf-caret">▾</span>`;
  b.classList.toggle('on', tagFilter.size > 0);
  b.title = tagFilter.size ? 'Filtrando por classificação — clique para alterar' : 'Mostrar só as classificações escolhidas';
  return b;
}
/* Coloca o botão na linha "Ordenar:" (cartões) ou na barra de filtro (tabela) */
function placeTagFilter() {
  const ov = document.getElementById('modal-overlay');
  if (!ov) return;
  const b = _tfButton();
  let host;
  if (ov.classList.contains('v2-cards')) {
    let th = document.getElementById('tag-filter-th');
    if (!th) { th = document.createElement('th'); th.id = 'tag-filter-th'; th.className = 'tag-filter-th'; }
    const tr = ov.querySelector('.data-table thead tr');
    if (tr && th.parentNode !== tr) tr.appendChild(th);
    host = th;
  } else {
    document.getElementById('tag-filter-th')?.remove();
    host = document.getElementById('modal-filter-bar');
  }
  if (host && b.parentNode !== host) host.appendChild(b);
  _tfButton();
  const cp = document.getElementById('btn-modal-copy-sel');
  if (cp) { cp.disabled = !tagFilter.size; cp.title = tagFilter.size ? 'Copiar só os tickets das classificações selecionadas' : 'Selecione classificações em "Classificação ▾" para usar'; }
}

function applyTagFilter() {
  document.querySelectorAll('#modal-tbody tr.ticket-row').forEach(r => {
    const k = getTicketTag(r.dataset.eventColor) ? r.dataset.eventColor : 'none';
    r.classList.toggle('tag-hidden', tagFilter.size > 0 && !tagFilter.has(k));
  });
  const tb = document.getElementById('modal-tbody');
  if (tb) {
    let empty = tb.querySelector('.tf-empty-row');
    const anyVisible = !!tb.querySelector('tr.ticket-row:not(.tag-hidden)');
    if (tagFilter.size && !anyVisible && tb.querySelector('tr.ticket-row')) {
      if (!empty) { empty = document.createElement('tr'); empty.className = 'tf-empty-row'; empty.innerHTML = '<td colspan="10">Nenhum ticket com as classificações selecionadas.</td>'; tb.appendChild(empty); }
    } else empty?.remove();
  }
  placeTagFilter();
}

function removeTagFilterMenu() { const m = document.getElementById('tag-filter-menu'); if (m) { m._cleanup?.(); m.remove(); } }
function toggleTagFilterMenu(btn) {
  if (document.getElementById('tag-filter-menu')) return removeTagFilterMenu();
  removeTagPicker();
  const counts = {};
  document.querySelectorAll('#modal-tbody tr.ticket-row').forEach(r => {
    const k = getTicketTag(r.dataset.eventColor) ? r.dataset.eventColor : 'none';
    counts[k] = (counts[k] || 0) + 1;
  });
  /* Só as classificações que têm ticket nesta lista (as já marcadas continuam, para poder desmarcar) */
  const opts = [...TICKET_TAGS.map(t => ({ key: t.key, label: t.label, bg: t.bg, fg: t.fg })), { key: 'none', label: 'Sem classificação', bg: '', fg: '' }]
    .filter(o => (counts[o.key] || 0) > 0 || tagFilter.has(o.key));
  const m = document.createElement('div');
  m.id = 'tag-filter-menu'; m.className = 'tag-picker tag-filter-menu';
  m.innerHTML = `<div class="tag-picker-head">Mostrar só</div>` +
    (opts.some(o => o.key !== 'none') ? '' : `<div class="tf-hint">Nenhum ticket classificado nesta lista.</div>`) +
    opts.map(o => `<label class="tf-opt${o.key === 'none' ? ' tf-none' : ''}" ${o.bg ? `style="--c:${o.bg};--fg:${o.fg}"` : ''}>
        <input type="checkbox" value="${o.key}" ${tagFilter.has(o.key) ? 'checked' : ''}>
        <span class="tf-name">${escapeHtml(o.label)}</span><span class="tf-count">${counts[o.key] || 0}</span>
      </label>`).join('') +
    `<button type="button" class="tag-opt tag-clear tf-clear">Mostrar todos</button>`;
  document.body.appendChild(m);
  if (window.matchMedia && matchMedia('(max-width: 640px)').matches) m.classList.add('tag-sheet');
  else {
    const r = btn.getBoundingClientRect(), mw = 250, mh = m.offsetHeight || 380;
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - mw - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - mh - 8)) + 'px';
  }
  m.addEventListener('click', e => e.stopPropagation());
  m.addEventListener('change', e => {
    const cb = e.target.closest('input[type=checkbox]');
    if (!cb) return;
    cb.checked ? tagFilter.add(cb.value) : tagFilter.delete(cb.value);
    applyTagFilter();
  });
  m.querySelector('.tf-clear').addEventListener('click', () => { tagFilter.clear(); applyTagFilter(); removeTagFilterMenu(); });
  const onClose = ev => { if (!m.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) removeTagFilterMenu(); };
  const onKey = ev => { if (ev.key === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); removeTagFilterMenu(); } };
  setTimeout(() => document.addEventListener('click', onClose, true), 0);
  window.addEventListener('keydown', onKey, true);   /* Esc fecha só a lista, não a janela */
  m._cleanup = () => { document.removeEventListener('click', onClose, true); window.removeEventListener('keydown', onKey, true); };
}

/* Copiar selecionados: tickets das classificações marcadas, agrupados na ordem da equipe */
async function copySelectedWA(btn) {
  if (!tagFilter.size) { if (typeof showActionToast === 'function') showActionToast('Escolha as classificações em "Classificação ▾"', 'error'); return; }
  const tk = appState.currentModalType, isRal = tk === 'ral';
  const list = (modalData[tk] && modalData[tk][appState.currentModalKey]) || [];
  const keyOf = i => { const k = (appState.ticketStates[makeIdentity(tk, i)] || {}).eventColor; return getTicketTag(k) ? k : 'none'; };
  const rank = k => { const x = TICKET_TAGS.findIndex(t => t.key === k); return x < 0 ? 99 : x; };
  const items = list.filter(i => tagFilter.has(keyOf(i)))
    .sort((a, b) => (rank(keyOf(a)) - rank(keyOf(b))) || (parseAbertura(b.abertura) - parseAbertura(a.abertura)));
  if (!items.length) { if (typeof showActionToast === 'function') showActionToast('Nenhum ticket com essas classificações', 'error'); return; }
  const title = (document.getElementById('modal-title')?.textContent || '').trim();
  const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const sel = [...tagFilter].map(k => k === 'none' ? '⚪ Sem classificação' : `${getTicketTag(k).emoji} ${getTicketTag(k).label}`).join(' · ');
  const head = `🚨 *COP REDE — ${title}*\n🏷️ ${sel}\n📊 ${items.length} ${isRal ? 'RAL' : 'REC'}${items.length > 1 ? 's' : ''} · 🕒 ${now}`;
  const text = head + '\n\n' + items.map(i => formatTicketWA(i, isRal)).join('\n\n');
  const ok = await _waWrite(text);
  _waFlash(btn, ok);
  if (typeof showActionToast === 'function')
    showActionToast(ok ? `${items.length} copiado${items.length > 1 ? 's' : ''} — cole no WhatsApp` : 'Não foi possível copiar', ok ? 'success' : 'error');
}

document.addEventListener('DOMContentLoaded', () => {
  /* Reaplica o filtro sempre que as classificações forem redesenhadas */
  const _rat = renderAllTicketTags;
  renderAllTicketTags = function () { const r = _rat.apply(this, arguments); applyTagFilter(); return r; };
  const _rt = renderTicketTag;
  renderTicketTag = function () { const r = _rt.apply(this, arguments); if (tagFilter.size) applyTagFilter(); return r; };
  const _open = openModal;
  openModal = function () { removeTagFilterMenu(); const r = _open.apply(this, arguments); setTimeout(applyTagFilter, 0); return r; };
  const _close = typeof closeModal === 'function' ? closeModal : null;
  if (_close) closeModal = function () { removeTagFilterMenu(); return _close.apply(this, arguments); };
});
