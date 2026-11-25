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
  _autoInboxCollapse(total);
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
  const listView = getInboxView() === 'list';
  container.classList.toggle('inbox-as-list', listView);
  if (listView) {
    /* Lista compacta: número, designação (RAL) ou cliente (REC) e o CF à direita */
    container.innerHTML = items.map(item => {
      const sub = isRal ? (item.designacao && item.designacao !== 'N/D' ? item.designacao : (item.extra || ''))
                        : (item.extra && item.extra !== 'N/D' ? item.extra : (item.designacao || ''));
      return `<div class="inbox-card inbox-row inbox-row-${tk}" data-identity="${escapeHtml(item.identity)}" role="button" tabindex="0" title="Toque para abrir o ticket na lista do CF">
        <div class="ir-main"><div class="ir-ticket">${escapeHtml(item.ticket || 'N/D')}</div><div class="ir-sub">${escapeHtml(sub || '—')}</div></div>
        <span class="ir-cf">${escapeHtml(item.cfOrigem)}</span>
        <button type="button" class="ir-ok" data-act="ciente" title="Ciente (tirar da lista)" aria-label="Ciente">✓</button>
      </div>`;
    }).join('');
  } else
  /* Mesmo visual do aviso de ticket novo (cartão com SLA e botões Ver / Copiar / Ciente) */
  container.innerHTML = (() => {
  const typeLbl  = isRal ? 'RAL' : 'REC';
  const extraLbl = isRal ? 'Tipo' : 'Cliente';
  return items.map(item => {
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
  })();

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
    const row = e.target.closest('.inbox-row');
    if (row) {
      const item = appState.inboxItems.find(i => i.identity === row.dataset.identity);
      if (item && typeof notifyOpenTicket === 'function') notifyOpenTicket(item.cfOrigem, tk, item.ticket);
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

/* Novas Entradas em Cards (padrão) ou Lista compacta — escolha salva neste aparelho */
const LS_INBOX_VIEW = 'sir_inbox_view';
function getInboxView() { try { return localStorage.getItem(LS_INBOX_VIEW) === 'list' ? 'list' : 'cards'; } catch (e) { return 'cards'; } }
function _paintInboxViewSeg() {
  const v = getInboxView();
  document.querySelectorAll('[data-inbox-view]').forEach(b => { const on = b.dataset.inboxView === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  document.getElementById('inbox-section')?.classList.toggle('inbox-list-mode', v === 'list');
}
function setInboxView(v) {
  try { localStorage.setItem(LS_INBOX_VIEW, v === 'list' ? 'list' : 'cards'); } catch (e) {}
  _paintInboxViewSeg();
  renderInboxType('ral', appState.inboxItems.filter(i => i.typeKey === 'ral'));
  renderInboxType('rec', appState.inboxItems.filter(i => i.typeKey === 'rec'));
}
document.addEventListener('DOMContentLoaded', _paintInboxViewSeg);
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const row = e.target.closest && e.target.closest('.inbox-row');
  if (row && e.target === row) row.click();
});

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

/* ── Recolher / expandir o card "Novas Entradas" ──
   Sem avisos: fica recolhido numa linha só. Chegou aviso novo: abre sozinho.
   Tocar no título sempre abre ou recolhe (com ou sem avisos). */
let _inboxLastTotal = -1;
function setInboxBodyVisible(v) {
  appState.inboxBodyVisible = !!v;
  document.getElementById('inbox-body-wrap')?.classList.toggle('collapsed', !v);
  document.getElementById('inbox-section')?.classList.toggle('inbox-collapsed', !v);
  document.getElementById('inbox-title-toggle')?.setAttribute('aria-expanded', String(!!v));
}
function toggleInboxBody() { setInboxBodyVisible(!appState.inboxBodyVisible); }
function _autoInboxCollapse(total) {
  if (total === 0) { if (_inboxLastTotal !== 0) setInboxBodyVisible(false); }   /* esvaziou: recolhe (uma vez) */
  else if (total > _inboxLastTotal) setInboxBodyVisible(true);   /* chegou coisa nova */
  _inboxLastTotal = total;
}
document.addEventListener('DOMContentLoaded', () => setInboxBodyVisible(false));
