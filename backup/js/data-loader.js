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
/* "REC-1/2026 ^ Cliente ^ Designação ^ Abertura ^ Tipo ^ CF | RAL-2/2026 ^ ..." → lista
   (link da coluna Ass.). Pode trazer REC e RAL; sem prefixo = REC. Repetidas entram 1 vez. */
function parseRecsAssoc(v) {
  const out = [], seen = new Set();
  String(v || '').split('|').forEach(part => {
    const f = part.split('^').map(x => x.trim());
    const m = (f[0] || '').match(/(?:\b(RAL|REC)\s*-?\s*)?(\d{4,8})\s*\/\s*(20\d\d)/i);
    if (!m) return;
    const kind = (m[1] || 'REC').toUpperCase() === 'RAL' ? 'ral' : 'rec';
    const ticket = `${kind.toUpperCase()}-${m[2]}/${m[3]}`;
    if (seen.has(ticket)) return;
    seen.add(ticket);
    out.push({ ticket, kind, cliente: f[1] || '', designacao: f[2] || '', abertura: f[3] || '', tipo: f[4] || '', cf: f[5] || '' });
  });
  return out;
}

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
  const durIdx      = getIdx('DURACAO');
  const tecIdx      = headers.findIndex(h => { const n = normalizeStr(h).trim(); return n === 'TECN.' || n === 'TECN' || n === 'TECNICO'; });
  const itemIdx     = headers.findIndex(h => normalizeStr(h).trim() === 'ITEM');
  /* RECs associadas à RAL: "Ass." = quantidade; "RECs Assoc." = lista (só o seu coletor envia) */
  const assIdx      = headers.findIndex(h => { const n = normalizeStr(h).trim(); return n === 'ASS.' || n === 'ASS'; });
  const recsAssIdx  = getIdx('RECS ASSOC');

  const allP = Object.keys(patternToCF);
  const normCF = s => String(s || '').toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
  const normToPattern = {};
  allP.forEach(p => { normToPattern[normCF(p)] = p; });
  const counts = {}, details = {}, qualidadeDetails = {};
  const dpDetails = [];
  allP.forEach(p => { counts[p] = 0; details[p] = []; qualidadeDetails[p] = []; });
  let total = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === '') continue;
    if (isRal && line.toUpperCase().indexOf('QUALIDADE') !== -1) {
      /* Captura RALs de Qualidade em estrutura separada em vez de descartar */
      const qCells = line.split(sep).map(clean);
      if (qCells.length > cfIdx) {
        const qp = normToPattern[normCF(qCells[cfIdx])];
        if (qp) {
          qualidadeDetails[qp].push({
            ticket:     numIdx > -1 && qCells[numIdx]     ? qCells[numIdx]     : 'N/D',
            designacao: desigIdx > -1 && qCells[desigIdx] ? qCells[desigIdx]   : 'N/D',
            cfOrigem:   patternToCF[qp],
            abertura:   aberturaIdx > -1 && qCells[aberturaIdx] ? qCells[aberturaIdx] : '',
          });
        }
      }
      continue;
    }
    const cells = line.split(sep).map(clean);
    if (cells.length <= cfIdx) continue;
    const cf = cells[cfIdx];
    if (!cf) continue;

    const buildItem = cfCod => {
      const ticket   = numIdx > -1 && cells[numIdx]     ? cells[numIdx]   : 'N/D';
      const desig    = desigIdx > -1 && cells[desigIdx] ? cells[desigIdx] : 'N/D';
      const abertura = aberturaIdx > -1 && cells[aberturaIdx] ? cells[aberturaIdx] : '';
      let extra = 'N/D';
      if (isRal && tipoIdx > -1 && cells[tipoIdx])  extra = cells[tipoIdx];
      else if (!isRal && cliIdx > -1 && cells[cliIdx]) extra = cells[cliIdx];
      const it = { ticket, designacao: desig, extra, cfOrigem: cfCod, abertura, cfRaw: cf };
      if (durIdx > -1 && cells[durIdx])   it.duracao = cells[durIdx];
      if (tecIdx > -1 && cells[tecIdx])   it.tecnico = cells[tecIdx];
      if (itemIdx > -1 && cells[itemIdx]) it.item    = cells[itemIdx];
      if (isRal && assIdx > -1) {
        it.ass = parseInt(String(cells[assIdx] || '').replace(/\D/g, ''), 10) || 0;
        if (recsAssIdx > -1) it.recs = parseRecsAssoc(cells[recsAssIdx]);
      }
      return it;
    };

    const ncf = normCF(cf);
    const matchedP = normToPattern[ncf];
    if (matchedP) {
      counts[matchedP]++; total++;
      details[matchedP].push(buildItem(patternToCF[matchedP]));
    } else if (ncf.startsWith('DP/')) {
      dpDetails.push(buildItem('DP'));
    }
  }
  return { counts, details, total, qualidadeDetails, dpDetails };
}

/* ── Fonte dos dados ──
   1º o seu servidor (SIR_PUSH_URL + chave de acesso); se não responder,
   a fonte pública entra como reserva. O rodapé mostra qual está em uso. */
function _ownSource() {
  try {
    const url = (typeof SIR_PUSH_URL === 'string' && SIR_PUSH_URL) ? SIR_PUSH_URL.replace(/\/+$/, '') : '';
    const key = localStorage.getItem('sir_push_key') || '';
    return (url && key) ? { url, key } : null;
  } catch (e) { return null; }
}
const DATA_SRC_LABEL = {
  coletor: ['Fonte: meu coletor', 'own'],
  espelho: ['Fonte: meu servidor', 'mir'],
  publica: ['Fonte: pública (reserva)', 'pub'],
};
function setDataSource(src, at) {
  appState.dataSource = { src, at: at || 0 };
  let el = document.getElementById('data-source');
  if (!el) {
    const footer = document.querySelector('.page-footer');
    if (!footer) return;
    el = document.createElement('span');
    el.id = 'data-source';
    footer.insertBefore(el, footer.lastElementChild);
  }
  const [txt, cls] = DATA_SRC_LABEL[src] || DATA_SRC_LABEL.publica;
  el.textContent = txt;
  el.className = 'data-source ds-' + cls;
  el.title = src === 'publica'
    ? 'Seu servidor não respondeu (ou falta a chave neste aparelho). Usando a fonte pública como reserva.'
    : (src === 'coletor' ? 'Dados coletados no SIR com o seu login' : 'Dados lidos do seu servidor (cópia da fonte pública)') + (at ? ' · última mudança ' + new Date(at).toLocaleString('pt-BR') : '') + ' — toque para ver detalhes';
  el.setAttribute('role', 'button'); el.tabIndex = 0;
}

/* v82: fetch com limite de tempo (rede travada não prende o painel) */
function _fetchLimite(url, opt, ms = 30000) {
  /* o limite cobre também a leitura do conteúdo (.text/.json) */
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...(opt || {}), signal: ac.signal }).then(r => {
    if (!r.ok) clearTimeout(t);
    const ler = f => r[f]().finally(() => clearTimeout(t));
    return { ok: r.ok, status: r.status, text: () => ler('text'), json: () => ler('json') };
  }, e => { clearTimeout(t); throw e; });
}

async function fetchAndParseInline(userSavedAreas) {
  let ralText = null, recText = null, src = 'publica', srcAt = 0;
  const own = _ownSource();
  if (own) {
    try {
      const r = await _fetchLimite(own.url + '/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: own.key }), cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d && d.ral && d.rec) { ralText = d.ral; recText = d.rec; src = d.src || 'espelho'; srcAt = d.at || 0; } }
    } catch (e) {}
  }
  if (ralText === null) {
    const ts = Date.now();
    const [ralResp, recResp] = await Promise.all([
      _fetchLimite(`${URLS.ral}?_=${ts}`, { cache: 'no-store' }),
      _fetchLimite(`${URLS.rec}?_=${ts}`, { cache: 'no-store' })
    ]);
    if (!ralResp.ok || !recResp.ok) throw new Error(`HTTP ${ralResp.status}/${recResp.status}`);
    [ralText, recText] = await Promise.all([ralResp.text(), recResp.text()]);
  }
  const ralRes = parseRawInline(ralText, true);
  const recRes = parseRawInline(recText, false);
  onDataReady(ralRes, recRes, ralText, recText, userSavedAreas);
  setDataSource(src, srcAt);
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
      if (msg.data.type === 'ERROR') { clearTimeout(limite); reject(new Error(msg.data.message)); return; }
      if (msg.data.type === 'RESULT') {
        clearTimeout(limite);
        const { ralRes, recRes, ralText, recText, src, srcAt } = msg.data;
        /* v82: erro em qualquer módulo não pode deixar a atualização presa para sempre */
        try { onDataReady(ralRes, recRes, ralText, recText, userSavedAreas); setDataSource(src, srcAt); resolve(); }
        catch (e) { console.warn('onDataReady', e); reject(e); }
      }
    };
    worker.onerror = err => { clearTimeout(limite); if (csvWorker === worker) csvWorker = null; reject(err); };
    /* v82: rede travada → desiste em 45 s e usa o último snapshot */
    const limite = setTimeout(() => {
      try { worker.terminate(); } catch (e) {}
      if (csvWorker === worker) csvWorker = null;
      reject(new Error('tempo esgotado ao buscar os dados'));
    }, 45000);
    worker.postMessage({ type: 'FETCH_PARSE', ralUrl: URLS.ral, recUrl: URLS.rec, own: _ownSource() });
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
  /* Tickets do "Alimentar off-line" que ainda não estão na fonte */
  if (typeof mergeOfflineFeed === 'function') mergeOfflineFeed(ralRes, recRes, ralText, recText);
  /* v101: RAL/REC inseridas à mão na tela do CF */
  if (typeof mergeManualTickets === 'function') mergeManualTickets(ralRes, recRes);
  appState._snapTexts = null;

  /* Alimenta o módulo de qualidade com as RALs capturadas separadamente */
  if (typeof buildQualidadeData === 'function' && ralRes.qualidadeDetails)
    buildQualidadeData(ralRes.qualidadeDetails);

  /* RECs e RALs associadas (inclusive de RALs em DP) entram com ticket mãe */
  if (typeof mergeAssociatedRecs === 'function') mergeAssociatedRecs(ralRes, recRes);

  /* Captura de DP para a Visualização SIR e o Painel Geral (ESRC já integra REGIONS) */
  appState.sirExtra = {
    dp: { ral: Array.isArray(ralRes.dpDetails) ? ralRes.dpDetails : [], rec: Array.isArray(recRes.dpDetails) ? recRes.dpDetails : [] },
    updatedAt: Date.now()
  };

  const ralR = buildRegionData(ralRes.counts, ralRes.details, true);
  const recR = buildRegionData(recRes.counts, recRes.details, false);
  if (typeof buildRecVideMap === 'function') buildRecVideMap();
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
  if (typeof _assocToast === 'function') _assocToast();
  appState.isOffline = false;
  setOfflineBanner(false);

  const now = Date.now();
  localStorage.setItem(LS_LAST_FETCH, now);

  document.getElementById('status-dot').style.background = '#2e7d32';
  document.getElementById('last-update').textContent = `Última atualização: ${new Date(now).toLocaleTimeString('pt-BR')}`;
  const flashEl = document.getElementById('status-flash');
  if (flashEl) { flashEl.classList.add('show'); setTimeout(() => flashEl.classList.remove('show'), 2200); }

  if (ralText && recText) dbSaveSnapshot(ralText, recText).catch(() => {});

  /* Se o modal de tickets do 1º dashboard estiver aberto (e não for Lixeira, nem houver
     popup aberto ou digitação em andamento), atualiza na hora para refletir entradas/saídas */
  try {
    const mOv = document.getElementById('modal-overlay');
    const isTrash = typeof isTrashKey === 'function' && isTrashKey(appState.currentModalKey);
    const hasPopup = !!document.querySelector('#tag-picker-popup, #obs-picker-popup, #color-picker-popup');
    if (mOv && mOv.classList.contains('active') && appState.currentModalType && appState.currentModalKey && !isTrash && !hasPopup) {
      const typing = mOv.querySelector('.obs-input:focus, .note-who-input:focus, #modal-filter-input:focus');
      if (!typing && typeof openModal === 'function') {
        const sc = document.getElementById('modal-body-scroll');
        const prevY = sc ? sc.scrollTop : 0;
        const prevFilter = document.getElementById('modal-filter-input')?.value || '';
        const titleTxt = document.getElementById('modal-title')?.textContent || '';
        openModal(appState.currentModalKey, appState.currentModalType === 'ral', titleTxt);
        if (prevFilter) {
          const inp = document.getElementById('modal-filter-input');
          if (inp) { inp.value = prevFilter; if (typeof filterModalTable === 'function') filterModalTable(); }
        }
        if (sc && prevY) sc.scrollTop = prevY;
      }
    }
  } catch (e) {}

  try { window.dispatchEvent(new CustomEvent('sir:data-ready', { detail: { at: now } })); } catch (e) {}
}

/* ── Offline snapshot fallback ── */
async function loadFromSnapshot(userSavedAreas) {
  let snap = await dbGetSnapshot().catch(() => null);
  /* Sem cópia guardada, mas com tickets do "Alimentar off-line": mostra só eles */
  if ((!snap || !snap.ralText || !snap.recText) && typeof offlineFeedCount === 'function' && offlineFeedCount() > 0)
    snap = { ralText: 'CF Exec.\n', recText: 'CF Exec.\n', ts: Date.now(), vazio: true };
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
    appState._snapTexts = snap.vazio ? null : [snap.ralText, snap.recText];
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
  try {
    if (IS_FILE) {
      await fetchAndParseInline(userSavedAreas);
    } else {
      await fetchAndParseWorker(userSavedAreas);
    }
  } catch(err) {
    document.getElementById('status-dot').style.background = '#c62828';
    let fallback = false;
    try { fallback = await loadFromSnapshot(userSavedAreas); } catch (e) {}
    if (!fallback) {
      document.getElementById('main-grid').innerHTML =
        `<div style="text-align:center;grid-column:1/-1;color:#c62828;font-size:22px;padding-top:40px;">
          Falha de comunicação: ${escapeHtml(String(err.message || err))}
        </div>`;
    }
  }

  } finally {
    isLoading = false;   /* v82: sempre libera a próxima atualização */
    resetCountdown(userSavedAreas);
  }
}

/* v82: a contagem usa o relógio (não o número de "tiques"): em segundo plano o navegador
   atrasa os timers, então ao voltar para o app ele atualiza na hora se o prazo já passou.
   Quando algum usuário está logado no 2º dashboard/Visualização SIR, acelera para 60s. */
function getActivePollInterval() {
  try {
    if (typeof getSirVisaoState === 'function' && getSirVisaoState().loggedIn) return 60000;
  } catch (e) {}
  return INTERVAL;
}
let nextLoadAt = 0, _lastAreas = null;
function resetCountdown(userSavedAreas) {
  const stepMs = getActivePollInterval();
  countdownVal = stepMs / 1000;
  nextLoadAt = Date.now() + stepMs; _lastAreas = userSavedAreas;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdownVal = Math.max(0, Math.round((nextLoadAt - Date.now()) / 1000));
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

document.addEventListener('visibilitychange', () => {
  if (document.hidden || isLoading || !nextLoadAt) return;
  if (Date.now() >= nextLoadAt) { if (countdownTimer) clearInterval(countdownTimer); loadAll(_lastAreas || getUserSavedAreas()); }
});
