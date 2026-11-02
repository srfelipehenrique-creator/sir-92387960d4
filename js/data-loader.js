let countdownVal   = INTERVAL / 1000;
let countdownTimer = null;
let isFirstLoad    = true;
let isLoading      = false;
let csvWorker      = null;

const IS_FILE = location.protocol === 'file:';
const LS_LAST_FETCH = 'sir_last_fetch_ts';

function resetForReload() { isFirstLoad = true; }

function loadNow(userSavedAreas) {
  if (!userSavedAreas) userSavedAreas = getUserSavedAreas();
  if (countdownTimer) clearInterval(countdownTimer);
  document.getElementById('countdown').textContent = 'Atualizando...';
  const btn = document.getElementById('btn-refresh-now');
  if (btn) btn.classList.add('spinning');
  loadAll(userSavedAreas).finally(() => {
    if (btn) btn.classList.remove('spinning');
  });
}

/* ── Inline CSV parser (used on file:// where Workers are blocked) ── */
function parseRawInline(text, isRal) {
  const lines = text.split('\n');
  if (lines.length < 2) return { counts:{}, details:{}, total:0 };
  let headerLine = '', headerIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t) { headerLine = t; headerIdx = i; break; }
  }
  const clean = s => s.replace(/^["'\s]+|["'\s]+$/g,'').trim();
  const trySep = sep => {
    const a = headerLine.split(sep).map(clean);
    const i = a.findIndex(h => h.toLowerCase() === CF_COL.toLowerCase());
    return i !== -1 ? { sep, idx: i, hArray: a } : null;
  };
  const vs = trySep(',') || trySep(';');
  if (!vs) return { counts:{}, details:{}, total:0 };

  const { sep, idx: cfIdx, hArray: headers } = vs;
  const getIdx = kw => headers.findIndex(h => normalizeStr(h).includes(kw));

  let numIdx = getIdx('NUM.RECUP');
  if (numIdx === -1) numIdx = getIdx('NUM.RAL');
  if (numIdx === -1) numIdx = headers.findIndex(h => { const n = normalizeStr(h); return n === 'TICKET' || n === 'NUMERO' || n === 'NUM'; });

  const desigIdx    = getIdx('DESIGNACAO');
  const tipoIdx     = getIdx('TIPO RAL');
  const cliIdx      = getIdx('CLIENTE');
  const aberturaIdx = getIdx('ABERTURA');

  const allP = Object.keys(patternToCF);
  const counts = {}, details = {}, qualidadeDetails = {};
  allP.forEach(p => { counts[p] = 0; details[p] = []; qualidadeDetails[p] = []; });
  let total = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    if (isRal && line.toUpperCase().indexOf('QUALIDADE') !== -1) {
      /* Captura RALs de Qualidade em estrutura separada em vez de descartar */
      const qCells = line.split(sep).map(clean);
      if (qCells.length > cfIdx) {
        const qcf = qCells[cfIdx];
        for (const p of allP) {
          if (qcf === p) {
            qualidadeDetails[p].push({
              ticket:     numIdx > -1 && qCells[numIdx]     ? qCells[numIdx]     : 'N/D',
              designacao: desigIdx > -1 && qCells[desigIdx] ? qCells[desigIdx]   : 'N/D',
              cfOrigem:   patternToCF[p],
              abertura:   aberturaIdx > -1 && qCells[aberturaIdx] ? qCells[aberturaIdx] : '',
            });
            break;
          }
        }
      }
      continue;
    }
    const cells = line.split(sep).map(clean);
    if (cells.length <= cfIdx) continue;
    const cf = cells[cfIdx];
    if (!cf) continue;
    for (const p of allP) {
      if (cf === p) {
        counts[p]++; total++;
        const ticket   = numIdx > -1 && cells[numIdx]     ? cells[numIdx]   : 'N/D';
        const desig    = desigIdx > -1 && cells[desigIdx] ? cells[desigIdx] : 'N/D';
        const abertura = aberturaIdx > -1 && cells[aberturaIdx] ? cells[aberturaIdx] : '';
        let extra = 'N/D';
        if (isRal && tipoIdx > -1 && cells[tipoIdx])  extra = cells[tipoIdx];
        else if (!isRal && cliIdx > -1 && cells[cliIdx]) extra = cells[cliIdx];
        details[p].push({ ticket, designacao: desig, extra, cfOrigem: patternToCF[p], abertura });
      }
    }
  }
  return { counts, details, total, qualidadeDetails };
}

async function fetchAndParseInline(userSavedAreas) {
  const ts = Date.now();
  const [ralResp, recResp] = await Promise.all([
    fetch(`${URLS.ral}?_=${ts}`, { cache: 'no-store' }),
    fetch(`${URLS.rec}?_=${ts}`, { cache: 'no-store' })
  ]);
  if (!ralResp.ok || !recResp.ok) throw new Error(`HTTP ${ralResp.status}/${recResp.status}`);
  const [ralText, recText] = await Promise.all([ralResp.text(), recResp.text()]);
  const ralRes = parseRawInline(ralText, true);
  const recRes = parseRawInline(recText, false);
  onDataReady(ralRes, recRes, ralText, recText, userSavedAreas);
}

/* ── Worker path (http/https only) ── */
function getWorker() {
  if (!csvWorker) csvWorker = new Worker('js/csv-worker.js');
  return csvWorker;
}

async function fetchAndParseWorker(userSavedAreas) {
  const worker = getWorker();
  return new Promise((resolve, reject) => {
    worker.onmessage = msg => {
      if (msg.data.type === 'ERROR') { reject(new Error(msg.data.message)); return; }
      if (msg.data.type === 'RESULT') {
        const { ralRes, recRes, ralText, recText } = msg.data;
        onDataReady(ralRes, recRes, ralText, recText, userSavedAreas);
        resolve();
      }
    };
    worker.onerror = err => reject(err);
    worker.postMessage({ type: 'FETCH_PARSE', ralUrl: URLS.ral, recUrl: URLS.rec });
  });
}

/* ── Shared state update ── */
function buildSnapshotMap(tk) {
  const snap = new Map();
  (modalData[tk]['ALL'] || []).forEach(i => snap.set(makeIdentity(tk, i), { ...i }));
  return snap;
}

function renderDashboard(ralRes, ralR, recRes, recR, userSavedAreas) {
  document.getElementById('main-grid').innerHTML =
    generateColumnHTML('RAL', ralR, ralRes.total, true,  userSavedAreas) +
    generateColumnHTML('REC', recR, recRes.total, false, userSavedAreas);

  document.querySelectorAll('.animate-num').forEach(el => {
    const v = parseInt(el.getAttribute('data-val'), 10);
    isFirstLoad ? animateValue(el, 0, v, 800) : (el.innerHTML = v);
  });
}

function onDataReady(ralRes, recRes, ralText, recText, userSavedAreas) {
  /* Alimenta o módulo de qualidade com as RALs capturadas separadamente */
  if (typeof buildQualidadeData === 'function' && ralRes.qualidadeDetails)
    buildQualidadeData(ralRes.qualidadeDetails);

  const ralR = buildRegionData(ralRes.counts, ralRes.details, true);
  const recR = buildRegionData(recRes.counts, recRes.details, false);
  computeFlatCFCounts(ralR, recR);

  appState.currentSnapshot.ral = buildSnapshotMap('ral');
  appState.currentSnapshot.rec = buildSnapshotMap('rec');

  if (!isFirstLoad) {
    appState.allNewIdentities = { ral: new Set(), rec: new Set() };
    ['ral', 'rec'].forEach(tk => {
      if (appState.lastSnapshotKeys[tk].size === 0) return;
      appState.currentSnapshot[tk].forEach((item, identity) => {
        if (!appState.lastSnapshotKeys[tk].has(identity))
          appState.allNewIdentities[tk].add(identity);
      });
    });
  }

  renderDashboard(ralRes, ralR, recRes, recR, userSavedAreas);

  if (isFirstLoad) {
    loadInboxState();
    if (appState.lastSnapshotKeys.ral.size > 0 || appState.lastSnapshotKeys.rec.size > 0)
      updateInboxWithNewEntries(userSavedAreas, true);
    else
      renderInbox();
  } else {
    updateInboxWithNewEntries(userSavedAreas, false);
  }

  appState.previousCounts = { ral: { ...appState.currentCounts.ral }, rec: { ...appState.currentCounts.rec } };
  appState.lastSnapshotKeys.ral = new Set(appState.currentSnapshot.ral.keys());
  appState.lastSnapshotKeys.rec = new Set(appState.currentSnapshot.rec.keys());
  saveInboxState();

  isFirstLoad = false;
  appState.isOffline = false;
  setOfflineBanner(false);

  const now = Date.now();
  localStorage.setItem(LS_LAST_FETCH, now);

  document.getElementById('status-dot').style.background = '#2e7d32';
  document.getElementById('last-update').textContent = `Última atualização: ${new Date(now).toLocaleTimeString('pt-BR')}`;
  const flashEl = document.getElementById('status-flash');
  if (flashEl) { flashEl.classList.add('show'); setTimeout(() => flashEl.classList.remove('show'), 2200); }

  if (ralText && recText) dbSaveSnapshot(ralText, recText).catch(() => {});
}

/* ── Offline snapshot fallback ── */
async function loadFromSnapshot(userSavedAreas) {
  const snap = await dbGetSnapshot().catch(() => null);
  if (!snap || !snap.ralText || !snap.recText) {
    document.getElementById('main-grid').innerHTML =
      `<div style="text-align:center;grid-column:1/-1;color:#c62828;font-size:16px;padding-top:40px;">
        Sem conexão e sem snapshot em cache. Verifique sua rede.
      </div>`;
    return false;
  }

  try {
    const ralRes = parseRawInline(snap.ralText, true);
    const recRes = parseRawInline(snap.recText, false);
    onDataReady(ralRes, recRes, null, null, userSavedAreas);
    appState.isOffline = true;
    setOfflineBanner(true);
    document.getElementById('last-update').textContent = `Offline — snapshot de ${new Date(snap.ts).toLocaleTimeString('pt-BR')}`;
    return true;
  } catch(e) {
    return false;
  }
}

/* ── Main load cycle ── */
async function loadAll(userSavedAreas) {
  if (isLoading) return;
  isLoading = true;
  document.getElementById('status-dot').style.background = '#d49800';
  if (countdownTimer) clearInterval(countdownTimer);

  if (isFirstLoad) {
    document.getElementById('main-grid').innerHTML =
      `<div class="dashboard-col">
        <div class="skeleton-card" style="height:68px;margin-bottom:18px;"></div>
        <div class="skeleton-card" style="height:104px;margin-bottom:16px;"></div>
        <div class="skeleton-card" style="height:104px;margin-bottom:16px;"></div>
      </div>
      <div class="dashboard-col">
        <div class="skeleton-card" style="height:68px;margin-bottom:18px;"></div>
        <div class="skeleton-card" style="height:104px;margin-bottom:16px;"></div>
        <div class="skeleton-card" style="height:104px;margin-bottom:16px;"></div>
      </div>`;
  }

  try {
    if (IS_FILE) {
      await fetchAndParseInline(userSavedAreas);
    } else {
      await fetchAndParseWorker(userSavedAreas);
    }
  } catch(err) {
    document.getElementById('status-dot').style.background = '#c62828';
    const fallback = await loadFromSnapshot(userSavedAreas);
    if (!fallback) {
      document.getElementById('main-grid').innerHTML =
        `<div style="text-align:center;grid-column:1/-1;color:#c62828;font-size:22px;padding-top:40px;">
          Falha de comunicação: ${String(err.message || err)}
        </div>`;
    }
  }

  isLoading = false;
  resetCountdown(userSavedAreas);
}

function resetCountdown(userSavedAreas) {
  countdownVal = INTERVAL / 1000;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdownVal--;
    document.getElementById('countdown').textContent =
      `Atualiza em ${Math.floor(countdownVal / 60)}:${String(countdownVal % 60).padStart(2,'0')}`;
    if (countdownVal <= 0) {
      clearInterval(countdownTimer);
      document.getElementById('countdown').textContent = 'Atualizando...';
      loadAll(userSavedAreas);
    }
  }, 1000);
}

function searchTicket(userSavedAreas) {
  const input = document.getElementById('ticket-search-input');
  const query = (input.value || '').replace(/\s+/g,'').replace(/[^A-Za-z0-9/-]/g,'').toUpperCase();
  if (!query) { input.focus(); return; }

  let found = null;
  for (const { tk, isRal } of [{ tk:'ral', isRal:true }, { tk:'rec', isRal:false }]) {
    const match = (modalData[tk]['ALL'] || []).find(i =>
      (i.ticket||'').replace(/\s+/g,'').replace(/[^A-Za-z0-9/-]/g,'').toUpperCase().includes(query)
    );
    if (match) {
      found = { tk, isRal, item: match, dataKey: match.cfOrigem, title: `${tk.toUpperCase()} :: ${match.cfOrigem}` };
      break;
    }
  }

  if (!found) {
    input.value = ''; input.placeholder = 'Ticket não encontrado';
    setTimeout(() => { input.placeholder = 'Buscar Ticket...'; }, 1800);
    return;
  }
  openModal(found.dataKey, found.isRal, found.title, found.item.ticket);
  input.select();
}
