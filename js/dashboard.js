/* ── Modos de exibição de CFs ── */
function _cfTitle(type, cf) {
  const name = CF_NAMES[cf];
  const label = type === 'ral' ? "RAL's" : "REC's";
  return name
    ? `${label} em tela no CF ${cf} - ${name}`
    : `${label} em tela no CF ${cf}`;
}

function _cfClass(val) {
  if (val > 9) return 'bg-red';
  if (val > 5) return 'bg-yellow';
  return 'bg-green';
}
function _cfHex(val) {
  if (val > 9) return '#c62828';
  if (val > 5) return '#d49800';
  return '#2e7d32';
}

function buildCFCard(cf, val, isRal, title, deltaHTML) {
  const mode  = (typeof getViewMode === 'function') ? getViewMode() : 'cards';
  const cls   = _cfClass(val);
  const hex   = _cfHex(val);
  /* Escapa aspas simples para uso seguro dentro de onclick="..."
     Nota: &#39; não funciona (browser decodifica antes do JS); \' sim. */
  const safeT = title.replace(/'/g, "\\'");

  if (mode === 'bars') {
    const pct = val === 0 ? 3 : Math.min(100, 8 + val * 9);
    return `<div class="cf-col-bar">
      <button class="cf-bar-btn" onclick="openModal('${cf}',${isRal},'${safeT}')">
        <span class="cf-bar-cf">${escapeHtml(cf)} ${deltaHTML}</span>
        <div class="cf-bar-track">
          <div class="cf-bar-fill ${cls}" style="--bar-w:${pct}%"></div>
        </div>
        <span class="cf-bar-val">${val}</span>
      </button>
    </div>`;
  }

  if (mode === 'bubbles') {
    const size = Math.max(52, Math.min(90, 52 + val * 3));
    const orbits = Math.min(val, 8);
    const orbitDots = Array.from({length: orbits}, (_, i) => {
      const angle = (360 / orbits) * i;
      const delay = (i * (2 / orbits)).toFixed(2);
      return `<span class="bubble-dot" style="--angle:${angle}deg;--delay:${delay}s;background:${hex};"></span>`;
    }).join('');
    return `<div class="cf-col">
      <div class="label-top">${escapeHtml(cf)} ${deltaHTML}</div>
      <button class="cf-bubble-wrap" onclick="openModal('${cf}',${isRal},'${safeT}')" style="--bsize:${size}px;--bcolor:${hex};">
        <div class="cf-bubble-core ${cls}">${val}</div>
        ${val > 0 ? `<div class="cf-bubble-ring">${orbitDots}</div>` : ''}
        ${val > 8 ? `<span class="bubble-extra">+${val-8}</span>` : ''}
      </button>
    </div>`;
  }

  if (mode === 'heatmap') {
    const maxVal = 20;
    const intensity = Math.min(1, val / maxVal);
    const alpha = (0.15 + intensity * 0.85).toFixed(2);
    return `<div class="cf-col">
      <div class="label-top">${escapeHtml(cf)} ${deltaHTML}</div>
      <button class="cf-heat-btn" onclick="openModal('${cf}',${isRal},'${safeT}')"
              style="--heat-color:${hex};--heat-alpha:${alpha};">
        <span class="cf-heat-val">${val}</span>
      </button>
    </div>`;
  }

  /* default: cards */
  return `<div class="cf-col">
    <div class="label-top">${escapeHtml(cf)} ${deltaHTML}</div>
    <button class="card cf-card ${cls}" onclick="openModal('${cf}',${isRal},'${safeT}')">
      <span class="animate-num" data-val="${val}">0</span>
    </button>
  </div>`;
}

function getFlatCFData(rd) {
  const flat = {};
  for (const reg in rd)
    for (const cf in rd[reg].items) flat[cf] = rd[reg].items[cf];
  return flat;
}

function computeFlatCFCounts(ral, rec) {
  appState.currentCounts.ral = getFlatCFData(ral);
  appState.currentCounts.rec = getFlatCFData(rec);
}

function buildRegionData(counts, detailsMap, isRal) {
  const result = {};
  const tk = isRal ? 'ral' : 'rec';
  modalData[tk] = {};
  let grand = [];
  for (const [rn, cfs] of Object.entries(REGIONS)) {
    const cfData = {};
    let rt = 0, rArr = [];
    for (const [cfKey, patterns] of Object.entries(cfs)) {
      let n = 0, cfArr = [];
      for (const p of patterns) {
        n += (counts[p] || 0);
        if (detailsMap[p]) cfArr.push(...detailsMap[p]);
      }
      cfData[cfKey] = n; rt += n;
      modalData[tk][cfKey] = cfArr;
      rArr.push(...cfArr);
    }
    result[rn] = { items: cfData, total: rt };
    modalData[tk][rn] = rArr;
    grand.push(...rArr);
  }
  modalData[tk]['ALL'] = grand;
  return result;
}

function getDeltaIndicator(tk, cf, val) {
  const p = appState.previousCounts[tk][cf];
  if (p === undefined || val <= p) return '';
  return `<span class="delta-indicator" title="Aumento desde a última atualização">+${val - p}</span>`;
}

function _gridClass() {
  const mode = (typeof getViewMode === 'function') ? getViewMode() : 'cards';
  return mode === 'bars' ? 'cfs-grid cfs-grid--bars' : 'cfs-grid';
}

function generateMyAreasHTML(title, regionData, isRal, userSavedAreas) {
  if (!userSavedAreas || !userSavedAreas.length) return '';
  const flat = getFlatCFData(regionData);
  const tk   = isRal ? 'ral' : 'rec';
  const key  = `MY_AREAS_${title}`;
  modalData[tk][key] = [];
  let total = 0, cfCards = '';

  userSavedAreas.forEach(cf => {
    const val = flat[cf] || 0; total += val;
    if (modalData[tk][cf]) modalData[tk][key].push(...modalData[tk][cf]);
    let cls = 'bg-green';
    if (val > 9) cls = 'bg-red'; else if (val > 5) cls = 'bg-yellow';
    const dh = getDeltaIndicator(tk, cf, val);
    cfCards += buildCFCard(cf, val, isRal, _cfTitle(isRal ? 'ral' : 'rec', cf), dh);
  });

  let rtCls = 'bg-green';
  if (total > 49) rtCls = 'bg-red'; else if (total > 29) rtCls = 'bg-yellow';

  return `<div class="region-row my-areas-row">
    <div class="region-total-col">
      <div class="label-top" style="color:#fff;">MINHAS ÁREAS</div>
      <button class="card region-card ${rtCls}" onclick="openModal('${key}',${isRal},'MINHAS ÁREAS ${title}')">
        <span class="animate-num" data-val="${total}">0</span>
      </button>
    </div>
    <div class="${_gridClass()}">${cfCards}</div>
  </div>`;
}

function generateColumnHTML(title, regionData, totalRecords, isRal, userSavedAreas) {
  let gCls = 'bg-green';
  if (totalRecords > 49) gCls = 'bg-red'; else if (totalRecords > 29) gCls = 'bg-yellow';

  let html = `<div class="dashboard-col">
    <div class="col-title">${title}</div>
    <div class="grand-total-section">
      <div class="label-top">TOTAL ${title} RRE</div>
      <button class="card grand-card ${gCls}" onclick="openModal('ALL',${isRal},'TOTAL ${title} RRE')">
        <span class="animate-num" data-val="${totalRecords}">0</span>
      </button>
    </div>`;

  if (userSavedAreas && userSavedAreas.length) {
    html += generateMyAreasHTML(title, regionData, isRal, userSavedAreas);
  } else {
    for (const [rn, data] of Object.entries(regionData)) {
      let rtCls = 'bg-green';
      if (data.total > 49) rtCls = 'bg-red'; else if (data.total > 29) rtCls = 'bg-yellow';
      html += `<div class="region-row">
        <div class="region-total-col">
          <div class="label-top">TOTAL ${title} ${rn}</div>
          <button class="card region-card ${rtCls}" onclick="openModal('${rn}',${isRal},'TOTAL ${title} ${rn}')">
            <span class="animate-num" data-val="${data.total}">0</span>
          </button>
        </div><div class="${_gridClass()}">`;
      for (const [cfKey, val] of Object.entries(data.items)) {
        let cls = 'bg-green';
        if (val > 9) cls = 'bg-red'; else if (val > 5) cls = 'bg-yellow';
        const dh = getDeltaIndicator(isRal ? 'ral' : 'rec', cfKey, val);
        html += buildCFCard(cfKey, val, isRal, _cfTitle(isRal ? 'ral' : 'rec', cfKey), dh);
      }
      html += `</div></div>`;
    }
  }
  html += `</div>`;
  return html;
}
