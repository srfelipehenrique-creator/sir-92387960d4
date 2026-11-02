/* ── SLA ── */
let slaInterval = null;

function calcSla(aberturaStr, isRal) {
  const opened = parseAbertura(aberturaStr);
  if (!opened) return null;
  const limitMs  = (isRal ? 6 : 4) * 3600000;
  const deadline = opened + limitMs;
  return { remaining: deadline - Date.now(), deadline };
}

function buildSlaCellHTML(aberturaStr, isRal) {
  const result = calcSla(aberturaStr, isRal);
  if (!result) return `<span class="sla-badge" style="color:#3d4754;">—</span>`;
  const { remaining } = result;
  if (remaining <= 0) {
    const over = Math.abs(remaining);
    const oh = Math.floor(over / 3600000);
    const om = Math.floor((over % 3600000) / 60000);
    return `<span class="sla-badge sla-lost">SLA PERDIDO<br><span style="font-size:10px;font-weight:400;">${oh > 0 ? `+${oh}h${String(om).padStart(2,'0')}m` : `+${om}m`}</span></span>`;
  }
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const timeStr = h > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${m}m`;
  let cls = 'sla-ok';
  if (remaining < 3600000) cls = 'sla-urgent';
  else if (remaining < 7200000) cls = 'sla-warn';
  return `<span class="sla-badge ${cls}">${timeStr}</span>`;
}

function updateSlaCells() {
  const tbody = document.getElementById('modal-tbody');
  if (!tbody) return;
  const isRal = appState.currentModalType === 'ral';
  tbody.querySelectorAll('tr.ticket-row').forEach(row => {
    const cell = row.querySelector('td.sla-col');
    if (cell) cell.innerHTML = buildSlaCellHTML(row.dataset.abertura || '', isRal);
  });
}

function startSlaTimer() {
  stopSlaTimer();
  slaInterval = setInterval(updateSlaCells, 30000);
}

function stopSlaTimer() {
  if (slaInterval) { clearInterval(slaInterval); slaInterval = null; }
}

/* ── OBS HTML builders ── */
function buildObsStatusHTML(status) {
  if (status === 'none') return `<button class="btn-obs-trigger" onclick="showObsPicker(event,this)" title="Definir status">···</button>`;
  const s = OBS_STATUSES.find(x => x.key === status);
  if (!s) return `<button class="btn-obs-trigger" onclick="showObsPicker(event,this)" title="Definir status">···</button>`;
  return `<button class="btn-obs-trigger" style="background:${s.color}1c;border-color:${s.color}66;color:${s.color};font-size:9px;" onclick="showObsPicker(event,this)" title="${s.label} — clique para alterar">${s.short}</button>`;
}

function buildObsHTML(obs) {
  if (!obs) return `<button class="btn-add-obs" onclick="startAddObs(this)" title="Adicionar nota">+</button>`;
  return `<div class="obs-content">
    <span class="obs-text" title="${escapeHtml(obs)}">${escapeHtml(obs)}</span>
    <button class="btn-obs-del" onclick="deleteObs(this)" title="Excluir">×</button>
  </div>`;
}

function startAddObs(btn) {
  const cell = btn.closest('td');
  cell.innerHTML = `<div class="obs-input-wrap">
    <input type="text" class="obs-input" maxlength="100" placeholder="Digite a nota..." autocomplete="off">
    <button class="btn-obs-confirm" onclick="confirmObs(this)" title="Confirmar">✓</button>
    <button class="btn-obs-cancel"  onclick="cancelObs(this)"  title="Cancelar">×</button>
  </div>`;
  const inp = cell.querySelector('.obs-input');
  inp.focus();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmObs(cell.querySelector('.btn-obs-confirm'));
    if (e.key === 'Escape') cancelObs(cell.querySelector('.btn-obs-cancel'));
  });
}

function confirmObs(btn) {
  const wrap = btn.closest('.obs-input-wrap');
  const val  = wrap.querySelector('.obs-input').value.trim();
  const row  = btn.closest('tr');
  const cell = wrap.closest('td');
  cell.innerHTML = buildObsHTML(val);
  cell.classList.toggle('has-obs', !!val);
  if (row) persistTicketState(row.dataset.identity, { obs: val });
  saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
}

function cancelObs(btn) {
  btn.closest('td').innerHTML = buildObsHTML('');
}

function deleteObs(btn) {
  const row  = btn.closest('tr');
  const cell = btn.closest('td');
  cell.innerHTML = buildObsHTML('');
  cell.classList.remove('has-obs');
  if (row) persistTicketState(row.dataset.identity, { obs: '' });
  saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
}

/* ── Color picker ── */
function showColorPicker(e, row) {
  e.preventDefault();
  removeColorPicker();
  const current = row.dataset.eventColor || 'none';
  const menu = document.createElement('div');
  menu.id = 'color-picker-popup';
  menu.className = 'cpicker';
  menu.innerHTML =
    `<div class="cpicker-label">Marcar ticket</div>` +
    `<div class="cpicker-swatches">` +
    SWATCH_COLORS.map(c =>
      `<button class="cpicker-sw${c.key === current ? ' active' : ''}" data-color="${c.key}" title="${c.label}" style="${c.bg ? 'background:' + c.bg : ''}"></button>`
    ).join('') +
    `</div><div class="cpicker-hint">clique para aplicar</div>`;
  document.body.appendChild(menu);
  const mw = 230, mh = 90;
  const x = Math.max(8, Math.min(e.clientX, window.innerWidth  - mw - 8));
  const y = Math.max(8, Math.min(e.clientY, window.innerHeight - mh - 8));
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  menu.querySelectorAll('.cpicker-sw').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const color = btn.dataset.color;
      row.dataset.eventColor = color;
      const dot = row.querySelector('.color-cycle-dot');
      if (dot) dot.className = `color-cycle-dot ev-${color}`;
      persistTicketState(row.dataset.identity, { eventColor: color });
      saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
      removeColorPicker();
    });
  });
  const onClose = ev => { if (!menu.contains(ev.target)) removeColorPicker(); };
  const onKey   = ev => { if (ev.key === 'Escape') removeColorPicker(); };
  setTimeout(() => { document.addEventListener('click', onClose); document.addEventListener('contextmenu', onClose); }, 0);
  document.addEventListener('keydown', onKey);
  menu._cleanup = () => {
    document.removeEventListener('click', onClose);
    document.removeEventListener('contextmenu', onClose);
    document.removeEventListener('keydown', onKey);
  };
}

function removeColorPicker() {
  const menu = document.getElementById('color-picker-popup');
  if (!menu) return;
  if (menu._cleanup) menu._cleanup();
  menu.remove();
}

function cycleEventColor(dot) {
  const row = dot.closest('tr');
  const cur = row.dataset.eventColor || 'none';
  const nxt = EVENT_COLORS[(EVENT_COLORS.indexOf(cur) + 1) % EVENT_COLORS.length];
  row.dataset.eventColor = nxt;
  dot.className = `color-cycle-dot ev-${nxt}`;
  persistTicketState(row.dataset.identity, { eventColor: nxt });
  saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
}

/* ── OBS status picker ── */
function showObsPicker(e, triggerBtn) {
  e.stopPropagation();
  removeObsPicker();
  const row     = triggerBtn.closest('tr');
  const current = row.dataset.obsStatus || 'none';
  const picker  = document.createElement('div');
  picker.id = 'obs-picker-popup';
  picker.className = 'obs-picker';
  picker.innerHTML =
    `<div class="obs-picker-header">Definir Status</div>` +
    OBS_STATUSES.map(s =>
      `<button class="obs-picker-option${current === s.key ? ' active' : ''}" data-key="${s.key}">
         <span class="obs-picker-dot" style="background:${s.color};"></span>${s.label}
       </button>`
    ).join('') +
    `<div class="obs-picker-sep"></div>
     <button class="obs-picker-clear" data-key="none">× Remover status</button>`;
  document.body.appendChild(picker);
  const rect = triggerBtn.getBoundingClientRect();
  const pw = 175, ph = 155;
  const x = Math.max(8, Math.min(rect.left, window.innerWidth - pw - 8));
  const y = rect.bottom + 4 + ph > window.innerHeight - 8 ? rect.top - ph - 4 : rect.bottom + 4;
  picker.style.left = x + 'px'; picker.style.top = y + 'px';
  picker.querySelectorAll('[data-key]').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      applyObsStatus(row, btn.dataset.key);
      removeObsPicker();
    });
  });
  const onClose = ev => { if (!picker.contains(ev.target)) removeObsPicker(); };
  const onKey   = ev => { if (ev.key === 'Escape') removeObsPicker(); };
  setTimeout(() => { document.addEventListener('click', onClose); document.addEventListener('keydown', onKey); }, 0);
  picker._cleanup = () => {
    document.removeEventListener('click', onClose);
    document.removeEventListener('keydown', onKey);
  };
}

function removeObsPicker() {
  const p = document.getElementById('obs-picker-popup');
  if (!p) return;
  if (p._cleanup) p._cleanup();
  p.remove();
}

function applyObsStatus(row, status) {
  row.dataset.obsStatus = status;
  row.classList.toggle('pinned-bottom', status !== 'none');
  const cell = row.querySelector('td.obs-status-col');
  if (cell) cell.innerHTML = buildObsStatusHTML(status);
  persistTicketState(row.dataset.identity, { obsStatus: status });
  applyPinnedSort();
  saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
}

/* ── Sort ── */
function sortRowsArray(rows) {
  rows.sort((a, b) => {
    const col = modalSortState.col;
    if (col === 'abertura') {
      const va = parseAbertura(a.dataset.abertura || '');
      const vb = parseAbertura(b.dataset.abertura || '');
      return modalSortState.dir === 'asc' ? va - vb : vb - va;
    }
    if (col === 'extra') {
      const va = ralTypeRank(a.dataset.extra || '');
      const vb = ralTypeRank(b.dataset.extra || '');
      if (va !== vb) return modalSortState.dir === 'asc' ? va - vb : vb - va;
      return parseAbertura(b.dataset.abertura || '') - parseAbertura(a.dataset.abertura || '');
    }
    return 0;
  });
}

function applyPinnedSort() {
  const tbody = document.getElementById('modal-tbody');
  if (!tbody) return;
  const allRows  = Array.from(tbody.querySelectorAll('tr'));
  const newRows  = allRows.filter(r => r.classList.contains('is-new'));
  const sepRow   = allRows.find(r => r.classList.contains('separator-row') && !r.classList.contains('pinned-separator-row'));
  const normalOld = allRows.filter(r => r.classList.contains('ticket-row') && !r.classList.contains('is-new') && (!r.dataset.obsStatus || r.dataset.obsStatus === 'none'));
  const pinned    = allRows.filter(r => r.classList.contains('ticket-row') && !r.classList.contains('is-new') && r.dataset.obsStatus && r.dataset.obsStatus !== 'none');
  sortRowsArray(normalOld);
  tbody.innerHTML = '';
  newRows.forEach(r => tbody.appendChild(r));
  if (sepRow && newRows.length && (normalOld.length + pinned.length)) tbody.appendChild(sepRow);
  normalOld.forEach(r => tbody.appendChild(r));
  if (pinned.length) {
    const pSep = document.createElement('tr');
    pSep.className = 'separator-row pinned-separator-row';
    pSep.innerHTML = `<td colspan="10">Aguardando — fora da ordenação</td>`;
    tbody.appendChild(pSep);
    pinned.forEach(r => tbody.appendChild(r));
  }
}

function sortModalTable(col) {
  if (modalSortState.col === col) modalSortState.dir = modalSortState.dir === 'asc' ? 'desc' : 'asc';
  else { modalSortState.dir = col === 'abertura' ? 'desc' : 'asc'; }
  modalSortState.col = col;
  updateSortHeaders();
  applyPinnedSort();
}

function updateSortHeaders() {
  document.querySelectorAll('.data-table th[data-sort-col]').forEach(th => {
    const col = th.dataset.sortCol;
    const si  = th.querySelector('.sort-icon');
    th.classList.toggle('sort-active', col === modalSortState.col);
    if (!si) return;
    si.textContent = col === modalSortState.col ? (modalSortState.dir === 'asc' ? '↑' : '↓') : '↕';
  });
}

/* ── Virtual table ── */
const VT_ROW_HEIGHT = 43;
const VT_BUFFER     = 8;
let vtAllRows       = [];
let vtContainer     = null;
let vtTopSpacer     = null;
let vtBotSpacer     = null;
let vtRenderedStart = 0;
let vtRenderedEnd   = 0;

function vtRender() {
  if (!vtContainer || !vtAllRows.length) return;
  const scrollTop = vtContainer.scrollTop;
  const viewH     = vtContainer.clientHeight;
  const total     = vtAllRows.length;

  let start = Math.max(0, Math.floor(scrollTop / VT_ROW_HEIGHT) - VT_BUFFER);
  let end   = Math.min(total, Math.ceil((scrollTop + viewH) / VT_ROW_HEIGHT) + VT_BUFFER);

  if (start === vtRenderedStart && end === vtRenderedEnd) return;
  vtRenderedStart = start;
  vtRenderedEnd   = end;

  const tbody = document.getElementById('modal-tbody');
  if (!tbody) return;

  const topH = start * VT_ROW_HEIGHT;
  const botH = Math.max(0, (total - end) * VT_ROW_HEIGHT);

  tbody.innerHTML = '';
  if (topH > 0) {
    const tr = document.createElement('tr');
    tr.className = 'vt-spacer';
    tr.innerHTML = `<td colspan="10" style="height:${topH}px;"></td>`;
    tbody.appendChild(tr);
  }
  vtAllRows.slice(start, end).forEach(html => {
    const tmp = document.createElement('tbody');
    tmp.innerHTML = html;
    tbody.appendChild(tmp.firstElementChild);
  });
  if (botH > 0) {
    const tr = document.createElement('tr');
    tr.className = 'vt-spacer';
    tr.innerHTML = `<td colspan="10" style="height:${botH}px;"></td>`;
    tbody.appendChild(tr);
  }
}

function vtInit(rowsHTML, scrollContainerEl) {
  vtAllRows = rowsHTML;
  vtContainer = scrollContainerEl;
  vtRenderedStart = 0; vtRenderedEnd = 0;
  if (vtContainer) vtContainer.addEventListener('scroll', vtRender, { passive: true });
  vtRender();
}

function vtDestroy() {
  if (vtContainer) vtContainer.removeEventListener('scroll', vtRender);
  vtAllRows = []; vtContainer = null;
}

/* ── Table state restore ── */
function restoreTableState(saved) {
  const tbody = document.getElementById('modal-tbody');
  if (!tbody || !saved) return;
  const byId = {};
  tbody.querySelectorAll('tr.ticket-row').forEach(r => { byId[r.dataset.identity] = r; });
  saved.forEach(entry => {
    const row = byId[entry.identity];
    if (!row) return;
    const color = entry.eventColor || 'none';
    row.dataset.eventColor = color;
    const dot = row.querySelector('.color-cycle-dot');
    if (dot) dot.className = `color-cycle-dot ev-${color}`;
    const notaCell = row.querySelector('td.obs-cell');
    if (notaCell) { notaCell.innerHTML = buildObsHTML(entry.obs || ''); notaCell.classList.toggle('has-obs', !!(entry.obs)); }
    const obsStatus = entry.obsStatus || 'none';
    row.dataset.obsStatus = obsStatus;
    if (obsStatus !== 'none') row.classList.add('pinned-bottom');
    const obsStatusCell = row.querySelector('td.obs-status-col');
    if (obsStatusCell) obsStatusCell.innerHTML = buildObsStatusHTML(obsStatus);
  });
}

function applyTicketStatesToTbody() {
  const tbody = document.getElementById('modal-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr.ticket-row').forEach(row => {
    const identity = row.dataset.identity;
    if (!identity) return;
    const st = appState.ticketStates[identity];
    if (!st) return;
    if (st.eventColor && st.eventColor !== 'none') {
      row.dataset.eventColor = st.eventColor;
      const dot = row.querySelector('.color-cycle-dot');
      if (dot) dot.className = `color-cycle-dot ev-${st.eventColor}`;
    }
    if (st.obs !== undefined && st.obs !== '') {
      const obsCell = row.querySelector('td.obs-cell');
      if (obsCell) obsCell.innerHTML = buildObsHTML(st.obs);
    }
    if (st.obsStatus && st.obsStatus !== 'none') {
      row.dataset.obsStatus = st.obsStatus;
      row.classList.add('pinned-bottom');
      const obsStatusCell = row.querySelector('td.obs-status-col');
      if (obsStatusCell) obsStatusCell.innerHTML = buildObsStatusHTML(st.obsStatus);
    }
  });
}

/* ── Partition + sort for open ── */
function partitionAndSort(arr, tk) {
  const newIds   = appState.allNewIdentities[tk] || new Set();
  const newItems = [], oldItems = [];
  arr.forEach(item => newIds.has(makeIdentity(tk, item)) ? newItems.push(item) : oldItems.push(item));
  oldItems.sort((a, b) => parseAbertura(b.abertura) - parseAbertura(a.abertura));
  return { newItems, oldItems };
}

/* ── Open modal ── */
function openModal(dataKey, isRal, titleOverride, highlightTicket = null) {
  const tk  = isRal ? 'ral' : 'rec';
  const arr = modalData[tk][dataKey] || [];

  appState.currentModalType = tk;
  appState.currentModalKey  = dataKey;
  vtDestroy();

  document.getElementById('modal-title').textContent = titleOverride;
  modalSortState.col = 'abertura'; modalSortState.dir = 'desc';

  const extraLabel = isRal ? 'Tipo RAL' : 'Cliente';
  document.getElementById('col-extra-header').innerHTML = `${extraLabel} ${isRal ? '<span class="sort-icon">↕</span>' : ''}`;

  const thAb = document.getElementById('th-abertura');
  if (thAb) { const si = thAb.querySelector('.sort-icon'); if (si) si.textContent = '↓'; }
  document.querySelectorAll('.data-table th.sort-active').forEach(t => t.classList.remove('sort-active'));
  if (thAb) thAb.classList.add('sort-active');

  const copyBtn = document.getElementById('copy-desig-btn');
  if (!isRal) {
    const valid = arr.filter(i => isLinkableDesig(i.designacao)).map(i => i.designacao);
    if (valid.length) {
      window._sirDesig = valid.join(' OU ');
      copyBtn.style.display = 'inline-block'; copyBtn.textContent = 'Copiar Designações';
    } else {
      copyBtn.style.display = 'none'; window._sirDesig = '';
    }
  } else {
    copyBtn.style.display = 'none'; window._sirDesig = '';
  }

  const tbody = document.getElementById('modal-tbody');
  const scrollContainer = document.getElementById('modal-body-scroll');

  if (!arr.length) {
    vtDestroy();
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state">Nenhum ticket mapeado nesta seleção.</div></td></tr>`;
  } else {
    const { newItems, oldItems } = partitionAndSort(arr, tk);
    const buildRowHTML = (item, isNew) => {
      const iden    = makeIdentity(tk, item);
      const hlClass = highlightTicket && normTicket(item.ticket) === normTicket(highlightTicket) ? 'row-highlight' : '';
      return `<tr class="ticket-row ${isNew ? 'is-new' : ''} ${hlClass}"
          data-ticket="${escapeHtml(item.ticket)}"
          data-identity="${escapeHtml(iden)}"
          data-event-color="none"
          data-obs-status="none"
          data-abertura="${escapeHtml(item.abertura || '')}"
          data-extra="${escapeHtml(item.extra || '')}">
        <td class="color-cycle-col"><span class="color-cycle-dot ev-none" onclick="cycleEventColor(this)" title="Clique para colorir"></span></td>
        <td><span class="cf-tag">${escapeHtml(item.cfOrigem)}</span></td>
        <td>${makeTicketHTML(item.ticket, isRal, item.designacao)}${isNew ? '<span class="new-badge">NOVO</span>' : ''}</td>
        <td>${makeDesigHTML(item.designacao, isRal)}</td>
        <td style="white-space:nowrap;font-size:12px;color:var(--text-muted);">${escapeHtml(item.abertura || '—')}</td>
        <td class="sla-col">${buildSlaCellHTML(item.abertura || '', isRal)}</td>
        <td>${escapeHtml(item.extra)}</td>
        <td class="obs-cell">${buildObsHTML('')}</td>
        <td class="obs-status-col">${buildObsStatusHTML('none')}</td>
        <td class="copy-col"><button class="btn-copy-ticket" onclick="copyTicketWA(this)" title="Copiar para enviar no WhatsApp">Copiar</button></td>
      </tr>`;
    };

    const newRowsHTML = newItems.map(i => buildRowHTML(i, true));
    const oldRowsHTML = oldItems.map(i => buildRowHTML(i, false));

    const sepHTML = newItems.length && oldItems.length
      ? `<tr class="separator-row"><td colspan="10">Anteriores — ordenados por abertura</td></tr>`
      : '';

    const allHTML = [...newRowsHTML, ...(sepHTML ? [sepHTML] : []), ...oldRowsHTML];

    /* Em cartões (layout novo / celular) as alturas variam: sem rolagem virtual */
    const _cards = typeof useTicketCards === 'function' && useTicketCards();
    if (allHTML.length > 80 && !_cards) {
      vtInit(allHTML, scrollContainer);
    } else {
      tbody.innerHTML = allHTML.join('');
    }

    const saved = loadTableState(tk, dataKey);
    if (saved) restoreTableState(saved);
    applyTicketStatesToTbody();
    applyPinnedSort();

    tbody.onclick = e => {
      const tl = e.target.closest('.ticket-link');
      if (tl && tl.dataset.url) { openTicketWindow(tl.dataset.url); return; }
      const dl = e.target.closest('.desig-link');
      if (dl && dl.dataset.url) {
        const w = 1200, h = 800;
        window.open(dl.dataset.url, 'DesigWin', `width=${w},height=${h},top=${Math.floor((screen.height-h)/2)},left=${Math.floor((screen.width-w)/2)},scrollbars=yes,resizable=yes`);
      }
    };
    tbody.oncontextmenu = e => {
      const row = e.target.closest('tr.ticket-row');
      if (row) showColorPicker(e, row);
    };
  }

  document.getElementById('modal-overlay').classList.add('active');
  startSlaTimer();

  if (arr.length && highlightTicket) {
    setTimeout(() => {
      const target = Array.from(document.querySelectorAll('#modal-tbody tr[data-ticket]'))
        .find(r => normTicket(r.dataset.ticket) === normTicket(highlightTicket));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}

function closeModal() {
  saveTableState(appState.currentModalType, appState.currentModalKey, document.getElementById('modal-tbody'));
  stopSlaTimer();
  removeColorPicker();
  removeObsPicker();
  vtDestroy();
  document.getElementById('modal-overlay').classList.remove('active');
}

function filterModalTable() {
  const inp    = document.getElementById('modal-filter-input');
  const countEl = document.getElementById('modal-filter-count');
  const tbody  = document.getElementById('modal-tbody');
  if (!inp || !tbody) return;
  const q = inp.value.toLowerCase().trim();
  const rows = Array.from(tbody.querySelectorAll('tr.ticket-row, tr.separator-row'));
  let visible = 0, total = 0;
  rows.forEach(row => {
    if (row.classList.contains('separator-row')) return;
    total++;
    if (!q) { row.style.display = ''; visible++; return; }
    const show = row.textContent.toLowerCase().includes(q);
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  tbody.querySelectorAll('tr.separator-row').forEach(sep => { sep.style.display = q ? 'none' : ''; });
  if (countEl) countEl.textContent = q ? `${visible} de ${total}` : '';
}

function exportModalCSV() {
  const tbody = document.getElementById('modal-tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr.ticket-row'));
  if (!rows.length) return;
  const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
  const lines = [['CF','Ticket','Designação','Abertura','SLA','Detalhe','Nota','Status OBS'].map(esc).join(',')];
  rows.forEach(row => {
    lines.push([
      row.querySelector('.cf-tag')?.textContent || '',
      (row.querySelector('.ticket-link, td:nth-child(3)')?.textContent || row.children[2]?.textContent || '').trim(),
      (row.querySelector('.desig-link, td:nth-child(4)')?.textContent || row.children[3]?.textContent || '').trim(),
      row.dataset.abertura || '',
      row.querySelector('.sla-badge')?.textContent.trim() || '',
      row.dataset.extra || '',
      row.querySelector('.obs-text')?.textContent || '',
      row.querySelector('.btn-obs-trigger')?.textContent.trim() || ''
    ].map(esc).join(','));
  });
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(document.getElementById('modal-title')?.textContent || 'tickets').replace(/[^a-z0-9]+/gi,'_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 400);
  showActionToast('CSV exportado');
}

function copyDesignations() {
  const desig = window._sirDesig || '';
  if (!desig) return;
  navigator.clipboard.writeText(desig).then(() => {
    const btn = document.getElementById('copy-desig-btn');
    btn.textContent = 'COPIADO!';
    btn.style.background = '#10b981'; btn.style.color = '#000';
    setTimeout(() => { btn.textContent = 'Copiar Designações'; btn.style.background = ''; btn.style.color = ''; }, 2000);
  });
}
