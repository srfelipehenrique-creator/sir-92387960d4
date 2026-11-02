/* ── Ticket states ── */
function loadTicketStates() {
  try {
    const raw    = JSON.parse(localStorage.getItem(STORAGE_TICKET) || '{}');
    const cutoff = Date.now() - 24 * 3600 * 1000;
    appState.ticketStates = {};
    for (const [id, data] of Object.entries(raw)) {
      if (!data.ts || data.ts > cutoff) appState.ticketStates[id] = data;
    }
  } catch(e) { appState.ticketStates = {}; }
}

function persistTicketState(identity, updates) {
  if (!identity) return;
  const cur  = appState.ticketStates[identity] || {};
  const next = { ...cur, ...updates, ts: Date.now() };
  const isNeutral = (!next.eventColor || next.eventColor === 'none')
                  && !next.obs
                  && (!next.obsStatus || next.obsStatus === 'none');
  if (isNeutral) delete appState.ticketStates[identity];
  else           appState.ticketStates[identity] = next;
  localStorage.setItem(STORAGE_TICKET, JSON.stringify(appState.ticketStates));
}

/* ── Table state ── */
function saveTableState(currentModalType, currentModalKey, tbodyEl) {
  if (!tbodyEl || !currentModalKey) return;
  const key   = `${currentModalType}::${currentModalKey}`;
  const order = [];
  tbodyEl.querySelectorAll('tr.ticket-row').forEach(row => {
    const obsEl = row.querySelector('.obs-text');
    order.push({
      identity:   row.dataset.identity || '',
      eventColor: row.dataset.eventColor || 'none',
      obs:        obsEl ? obsEl.textContent : '',
      obsStatus:  row.dataset.obsStatus || 'none'
    });
  });
  const all = JSON.parse(localStorage.getItem(STORAGE_TABLE) || '{}');
  all[key] = order;
  if (!all._ts) all._ts = {};
  all._ts[key] = Date.now();
  localStorage.setItem(STORAGE_TABLE, JSON.stringify(all));
}

function loadTableState(typeKey, dataKey) {
  const k      = `${typeKey}::${dataKey}`;
  const all    = JSON.parse(localStorage.getItem(STORAGE_TABLE) || '{}');
  const ts     = (all._ts || {})[k];
  const cutoff = Date.now() - 24 * 3600 * 1000;
  if (ts && ts < cutoff) return null;
  return all[k] || null;
}

/* ── Inbox state ── */
function saveInboxState() {
  localStorage.setItem(STORAGE_INBOX, JSON.stringify({
    inboxItems:       appState.inboxItems,
    acknowledgedKeys: Array.from(appState.acknowledgedInboxKeys),
    lastSnapshotKeys: {
      ral: Array.from(appState.lastSnapshotKeys.ral),
      rec: Array.from(appState.lastSnapshotKeys.rec)
    }
  }));
}

function loadInboxState() {
  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_INBOX));
    if (state) {
      appState.inboxItems = state.inboxItems || [];
      appState.acknowledgedInboxKeys = new Set(state.acknowledgedKeys || []);
      if (state.lastSnapshotKeys) {
        appState.lastSnapshotKeys.ral = new Set(state.lastSnapshotKeys.ral || []);
        appState.lastSnapshotKeys.rec = new Set(state.lastSnapshotKeys.rec || []);
      }
    }
  } catch(e) { console.error('Inbox state load:', e); }
}

/* ── Storage cleanup ── */
function cleanupStorage() {
  const cutoff24h = Date.now() - 24 * 3600 * 1000;

  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_TABLE) || '{}');
    const ts  = all._ts || {};
    let changed = false;
    Object.keys(ts).forEach(k => {
      if (ts[k] < cutoff24h) { delete all[k]; delete ts[k]; changed = true; }
    });
    if (changed) { all._ts = ts; localStorage.setItem(STORAGE_TABLE, JSON.stringify(all)); }
  } catch(e) {}

  try {
    const ts = JSON.parse(localStorage.getItem(STORAGE_TICKET) || '{}');
    let changed = false;
    for (const id of Object.keys(ts)) {
      if (ts[id].ts && ts[id].ts < cutoff24h) { delete ts[id]; changed = true; }
    }
    if (changed) localStorage.setItem(STORAGE_TICKET, JSON.stringify(ts));
  } catch(e) {}

  try {
    const state = JSON.parse(localStorage.getItem(STORAGE_INBOX) || '{}');
    if (state.inboxItems?.length) {
      const antes = state.inboxItems.length;
      state.inboxItems = state.inboxItems.filter(i => !i.ts || i.ts > cutoff24h);
      if (state.inboxItems.length < antes) localStorage.setItem(STORAGE_INBOX, JSON.stringify(state));
    }
    if (state.acknowledgedKeys?.length > 500) {
      state.acknowledgedKeys = state.acknowledgedKeys.slice(-500);
      localStorage.setItem(STORAGE_INBOX, JSON.stringify(state));
    }
  } catch(e) {}
}
