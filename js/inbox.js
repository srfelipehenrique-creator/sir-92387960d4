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
  container.innerHTML = items.map(item => {
    const ticketHTML = makeTicketHTML(item.ticket, isRal, item.designacao);
    const desigHTML  = makeDesigHTML(item.designacao, isRal);
    const timeStr    = item.abertura ? item.abertura.replace(' - ', ' · ') : '—';
    return `<div class="inbox-entry${item.isBrandNew ? ' brand-new' : ''}">
      <div class="inbox-entry-cf"><span class="cf-tag">${escapeHtml(item.cfOrigem)}</span></div>
      <div class="inbox-entry-body">
        <div class="inbox-entry-top">
          <span class="inbox-entry-ticket">${ticketHTML}</span>
          <span class="inbox-entry-desig">${desigHTML}</span>
        </div>
        <div class="inbox-entry-bottom">
          <span class="inbox-entry-extra">${escapeHtml(item.extra || '—')}</span>
          <span class="inbox-entry-time">${escapeHtml(timeStr)}</span>
        </div>
      </div>
      <div class="inbox-entry-action">
        <button class="btn-ack" onclick="acknowledgeInboxItem('${escapeHtml(item.identity)}')">Ciente</button>
      </div>
    </div>`;
  }).join('');

  container.onclick = e => {
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
