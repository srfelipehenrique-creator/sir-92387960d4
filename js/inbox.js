function updateInboxWithNewEntries(userSavedAreas, isStartup = false) {
  if (!userSavedAreas.length) { renderInbox(); return; }
  let changed = false;

  ['ral', 'rec'].forEach(tk => {
    const prev    = appState.lastSnapshotKeys[tk];
    const current = appState.currentSnapshot[tk];
    if (prev.size === 0) return;
    current.forEach((item, identity) => {
      if (prev.has(identity)) return;
      if (!userSavedAreas.includes(item.cfOrigem)) return;
      if (appState.acknowledgedInboxKeys.has(identity)) return;
      if (appState.inboxItems.some(e => e.identity === identity)) return;
      appState.inboxItems.unshift({ identity, typeKey: tk, ts: Date.now(), isBrandNew: true, ...item });
      changed = true;
    });
  });

  if (changed || isStartup) { renderInbox(); saveInboxState(); }
}

function renderInbox() {
  const total = appState.inboxItems.length;
  document.getElementById('inbox-count').textContent = total;
  const btnAll = document.getElementById('btn-inbox-ack-all');
  if (btnAll) btnAll.style.display = total > 0 ? '' : 'none';
  renderInboxType('ral', appState.inboxItems.filter(i => i.typeKey === 'ral'));
  renderInboxType('rec', appState.inboxItems.filter(i => i.typeKey === 'rec'));
  updatePageTitle();
  playInboxSound();
  setTimeout(() => { appState.inboxItems.forEach(i => { delete i.isBrandNew; }); }, 3000);
}

function renderInboxType(tk, items) {
  const container = document.getElementById(`inbox-tbody-${tk}`);
  const empty     = document.getElementById(`inbox-empty-${tk}`);
  const countEl   = document.getElementById(`inbox-count-${tk}`);
  const isRal     = tk === 'ral';
  if (countEl) countEl.textContent = items.length;
  if (!items.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  /* Mesmo visual do aviso de ticket novo (cartão com SLA e botões Ver / Copiar / Ciente) */
  const typeLbl  = isRal ? 'RAL' : 'REC';
  const extraLbl = isRal ? 'Tipo' : 'Cliente';
  container.innerHTML = items.map(item => {
    const ticketHTML = item.ticket ? makeTicketHTML(item.ticket, isRal, item.designacao) : 'N/D';
    const desigHTML  = item.designacao ? makeDesigHTML(item.designacao, isRal) : '—';
    const sla        = typeof _ntSla === 'function' ? _ntSla(item, isRal) : null;
    const hasExtra   = item.extra && item.extra !== 'N/D';
    return `<div class="nt-card nt-in inbox-card" data-identity="${escapeHtml(item.identity)}">
      <div class="nt-head">
        <span class="nt-badge nt-${tk}">${typeLbl} nova</span>
        <span class="cf-tag">${escapeHtml(item.cfOrigem)}</span>
        ${sla ? `<span class="nt-sla nt-sla-${sla.cls}">${escapeHtml(sla.txt)}</span>` : ''}
      </div>
      <div class="nt-ticket">${ticketHTML}</div>
      <div class="nt-desig">${desigHTML}</div>
      <div class="nt-meta">
        ${hasExtra ? `<span>${extraLbl}: ${escapeHtml(item.extra)}</span>` : ''}
        ${item.abertura ? `<span>Abertura ${escapeHtml(item.abertura.replace(' - ', ' · '))}</span>` : ''}
      </div>
      <div class="nt-actions">
        <button type="button" class="nt-btn nt-primary" data-act="ver">Ver</button>
        <button type="button" class="nt-btn nt-copy" data-act="copiar">Copiar</button>
        <button type="button" class="nt-btn" data-act="ciente">Ciente</button>
      </div>
    </div>`;
  }).join('');

  container.onclick = async e => {
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) {
      const identity = actBtn.closest('.inbox-card')?.dataset.identity;
      const item = appState.inboxItems.find(i => i.identity === identity);
      if (!item) return;
      const act = actBtn.dataset.act;
      if (act === 'ciente') acknowledgeInboxItem(item.identity);
      if (act === 'ver' && typeof notifyOpenTicket === 'function') notifyOpenTicket(item.cfOrigem, tk, item.ticket);
      if (act === 'copiar' && typeof formatTicketWA === 'function' && typeof _waWrite === 'function') {
        const ok = await _waWrite(formatTicketWA(item, isRal));
        if (typeof _waFlash === 'function') _waFlash(actBtn, ok);
      }
      return;
    }
    const tl = e.target.closest('.ticket-link');
    if (tl && tl.dataset.url) { openTicketWindow(tl.dataset.url); return; }
    const dl = e.target.closest('.desig-link');
    if (dl && dl.dataset.url) {
      const w = 1200, h = 800;
      window.open(dl.dataset.url, 'DesigWin', `width=${w},height=${h},top=${Math.floor((screen.height-h)/2)},left=${Math.floor((screen.width-w)/2)},scrollbars=yes,resizable=yes`);
    }
  };
}

function acknowledgeAllInboxItems() {
  appState.inboxItems.forEach(i => appState.acknowledgedInboxKeys.add(i.identity));
  appState.inboxItems = [];
  renderInbox();
  saveInboxState();
}

function acknowledgeInboxItem(identity) {
  appState.acknowledgedInboxKeys.add(identity);
  appState.inboxItems = appState.inboxItems.filter(i => i.identity !== identity);
  renderInbox();
  saveInboxState();
}

function toggleInboxBody() {
  const wrap = document.getElementById('inbox-body-wrap');
  const btn  = document.getElementById('btn-inbox-toggle');
  appState.inboxBodyVisible = !appState.inboxBodyVisible;
  wrap.classList.toggle('collapsed', !appState.inboxBodyVisible);
  btn.textContent = appState.inboxBodyVisible ? 'Ocultar' : 'Mostrar';
}
