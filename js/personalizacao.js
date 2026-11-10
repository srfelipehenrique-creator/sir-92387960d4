/* ── Personalização: tema, densidade, toolbar, modos de exibição ── */

const LS_THEME      = 'sir_theme';
const LS_TOOLBAR    = 'sir_toolbar_config';
const LS_DENSITY    = 'sir_compact';
const LS_VIEW_MODE  = 'sir_view_mode';

/* ── Botões configuráveis ── */
const TOOLBAR_DEFS = [
  { id: 'cfg-torpedos',   label: 'Torpedos',   icon: 'megaphone',    onclick: 'openTorpedos()',     visible: true, group: 'incidente' },
  { id: 'cfg-mascaras',   label: 'Máscaras',   icon: 'bot',          onclick: 'openMascaras()',     visible: true, group: 'incidente' },
  { id: 'cfg-qualidade',  label: 'Qualidade',  icon: 'shield-alert', onclick: 'openQualidade()',    visible: true, group: 'incidente' },
  { id: 'cfg-scripts',    label: 'Textos',     icon: 'pen-line',     onclick: 'openScripts()',      visible: true, group: 'consulta'  },
  { id: 'cfg-historico',  label: 'Histórico',  icon: 'archive',      onclick: 'openHistorico()',    visible: true, group: 'consulta'  },
  { id: 'cfg-siglas',     label: 'Siglas',     icon: 'book-open',    onclick: 'openSiglas()',       visible: true, group: 'consulta'  },
  { id: 'cfg-nodes',      label: 'Endereços de Node', icon: 'map-pinned', onclick: 'openNodes()',   visible: true, group: 'consulta'  },
  { id: 'cfg-timer',      label: 'Timer',      icon: 'timer',        onclick: 'toggleTimerFloat()', visible: true, group: 'util'      },
];

const TOOL_GROUPS = {
  incidente: 'Incidente',
  consulta:  'Consulta',
  util:      'Utilitários',
};

const THEMES = [
  { id: 'default', label: 'Índigo',    color: '#6366f1' },
  { id: 'blue',    label: 'Azul',      color: '#3b82f6' },
  { id: 'cyan',    label: 'Ciano',     color: '#06b6d4' },
  { id: 'green',   label: 'Esmeralda', color: '#10b981' },
  { id: 'amber',   label: 'Âmbar',    color: '#f59e0b' },
  { id: 'rose',    label: 'Rosa',      color: '#ec4899' },
  { id: 'amoled',  label: 'AMOLED',   color: '#6366f1', dark: true },
];

const VIEW_MODES = [
  { id: 'cards',   label: 'Cards',      icon: '▦', desc: 'Padrão' },
  { id: 'bars',    label: 'Barras',     icon: '▮', desc: 'Gráfico' },
  { id: 'bubbles', label: 'Bolhas',     icon: '◎', desc: 'Orbital' },
  { id: 'heatmap', label: 'Mapa Calor', icon: '▣', desc: 'Intensidade' },
];

/* ── Estado restaurável ── */
let _originalState = null;

function _captureState() {
  return {
    theme:   localStorage.getItem(LS_THEME) || 'default',
    compact: localStorage.getItem(LS_DENSITY) === 'true',
    view:    localStorage.getItem(LS_VIEW_MODE) || 'cards',
    toolbar: localStorage.getItem(LS_TOOLBAR) || null,
  };
}

function _restoreState(s) {
  applyTheme(s.theme);
  setDensity(s.compact ? 'compact' : 'normal', true);
  setViewMode(s.view, true);
  if (s.toolbar) localStorage.setItem(LS_TOOLBAR, s.toolbar);
  else localStorage.removeItem(LS_TOOLBAR);
  renderToolbarButtons();
}

/* ── Toolbar ── */
function loadToolbarConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_TOOLBAR) || 'null');
    if (!saved) return TOOLBAR_DEFS.map((d, i) => ({ ...d, order: i }));
    const list = saved.map(s => {
      const def = TOOLBAR_DEFS.find(d => d.id === s.id);
      return def ? { ...def, visible: s.visible, order: s.order } : null;
    }).filter(Boolean);
    /* Botões novos (de versões mais recentes) entram visíveis, logo após o seu grupo */
    TOOLBAR_DEFS.forEach(def => {
      if (list.some(x => x.id === def.id)) return;
      const sameGroup = list.filter(x => x.group === def.group);
      const after = sameGroup.length ? Math.max(...sameGroup.map(x => x.order)) + 0.5 : list.length;
      list.push({ ...def, order: after });
    });
    return list.sort((a, b) => a.order - b.order).map((x, i) => ({ ...x, order: i }));
  } catch { return TOOLBAR_DEFS.map((d, i) => ({ ...d, order: i })); }
}

function saveToolbarConfig(config) {
  localStorage.setItem(LS_TOOLBAR, JSON.stringify(
    config.map(({ id, visible, order }) => ({ id, visible, order }))
  ));
}

function renderToolbarButtons() {
  const container = document.getElementById('header-action-btns');
  if (!container) return;
  const config = loadToolbarConfig().sort((a, b) => a.order - b.order).filter(b => b.visible);

  if (!config.length) { container.innerHTML = ''; return; }

  /* Constrói a barra segmentada agrupada */
  let html = '<div class="tool-bar-grouped" role="toolbar" aria-label="Ferramentas">';
  let lastGroup = null;
  config.forEach(btn => {
    const g = btn.group || 'util';
    if (lastGroup !== null && g !== lastGroup)
      html += '<div class="tool-group-sep" aria-hidden="true"></div>';
    html += `<button class="tool-group-btn" onclick="${btn.onclick}"
               title="${btn.label}" aria-label="${btn.label}">
               <i data-lucide="${btn.icon}"></i>
               <span>${btn.label}</span>
             </button>`;
    lastGroup = g;
  });
  html += '</div>';

  container.innerHTML = html;
  if (typeof lucide !== 'undefined')
    lucide.createIcons({ nodes: Array.from(container.querySelectorAll('[data-lucide]')) });
}

/* ── Tema ── */
function applyTheme(themeId) {
  localStorage.setItem(LS_THEME, themeId);
  document.documentElement.setAttribute('data-theme', themeId);
  updatePreview();
}

function initTheme() {
  const saved = localStorage.getItem(LS_THEME) || 'default';
  document.documentElement.setAttribute('data-theme', saved);
}

/* ── Densidade ── */
function setDensity(mode, silent) {
  const compact = mode === 'compact';
  document.body.classList.toggle('compact', compact);
  localStorage.setItem(LS_DENSITY, compact);
  if (!silent) updatePreview();
  syncDensityBtns();
}

function syncDensityBtns() {
  const compact = localStorage.getItem(LS_DENSITY) === 'true';
  document.getElementById('density-normal')?.classList.toggle('density-active', !compact);
  document.getElementById('density-compact')?.classList.toggle('density-active', compact);
}

/* ── Modos de exibição ── */
function getViewMode() { return localStorage.getItem(LS_VIEW_MODE) || 'cards'; }

function setViewMode(mode, silent) {
  localStorage.setItem(LS_VIEW_MODE, mode);
  if (!silent) {
    updatePreview();
    /* Re-renderiza o dashboard se já carregado */
    if (typeof loadAll === 'function' && typeof getUserSavedAreas === 'function') {
      resetForReload();
      loadAll(getUserSavedAreas());
    }
  }
  syncViewModeBtns();
}

function syncViewModeBtns() {
  const cur = getViewMode();
  document.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.classList.toggle('vmode-active', btn.dataset.viewMode === cur);
  });
}

/* ── Modal ── */
function openPersonalizacao() {
  _originalState = _captureState();

  /* Fecha todas as seções ao abrir (cada abertura começa limpa) */
  document.querySelectorAll('#personalizacao-modal .cfg-section').forEach(s => s.classList.remove('cfg-open'));

  renderThemePicker();
  renderToolbarEditor();
  syncDensityBtns();
  syncViewModeBtns();
  syncCfgToggles();

  /* Mostra botão de install PWA somente quando disponível */
  const pwaCfgBtn = document.getElementById('cfg-pwa-btn');
  if (pwaCfgBtn) pwaCfgBtn.style.display = window._pwaInstallPrompt ? '' : 'none';

  document.getElementById('personalizacao-modal').classList.add('active');
}

function syncCfgToggles() {
  const soundTrack    = document.getElementById('cfg-sound-track');
  const contrastTrack = document.getElementById('cfg-contrast-track');
  if (soundTrack)    soundTrack.classList.toggle('on', !!soundEnabled);
  if (contrastTrack) contrastTrack.classList.toggle('on', document.body.classList.contains('high-contrast'));
}

function toggleCfgSection(hd) {
  const section = hd.closest('.cfg-section');
  if (!section) return;
  section.classList.toggle('cfg-open');
  /* Re-renderiza ícones Lucide dentro do body expandido na primeira abertura */
  if (section.classList.contains('cfg-open') && typeof lucide !== 'undefined') {
    lucide.createIcons({ nodes: Array.from(section.querySelectorAll('[data-lucide]')) });
  }
}

function closePersonalizacao() {
  document.getElementById('personalizacao-modal').classList.remove('active');
}

function savePersonalizacao() {
  /* Estado já está salvo no localStorage via applyTheme/setDensity/etc. */
  closePersonalizacao();
  showActionToast('Preferências salvas!', 'success');
}

function cancelPersonalizacao() {
  if (_originalState) _restoreState(_originalState);
  closePersonalizacao();
}

/* ── Theme picker ── */
function renderThemePicker() {
  const container = document.getElementById('theme-swatches');
  if (!container) return;
  const current = localStorage.getItem(LS_THEME) || 'default';
  container.innerHTML = THEMES.map(t => `
    <button class="theme-swatch${t.id === current ? ' theme-active' : ''}"
            onclick="_selectTheme(this,'${t.id}')" title="${t.label}" data-theme-btn="${t.id}">
      <span class="theme-swatch-dot" style="background:${t.color}${t.dark ? ';box-shadow:0 0 0 5px #000 inset' : ''}"></span>
      <span class="theme-swatch-label">${t.label}</span>
    </button>`
  ).join('');
}

function _selectTheme(btn, themeId) {
  document.querySelectorAll('.theme-swatch').forEach(el => el.classList.remove('theme-active'));
  btn.classList.add('theme-active');
  applyTheme(themeId);
}

/* ── Toolbar editor ── */
function renderToolbarEditor() {
  const list = document.getElementById('toolbar-editor-list');
  if (!list) return;
  const config = loadToolbarConfig().sort((a, b) => a.order - b.order);

  const parts = [];
  let lastGroup = null;
  config.forEach(btn => {
    const g = btn.group || 'util';
    if (g !== lastGroup) {
      parts.push(`<div class="tbar-group-label">${TOOL_GROUPS[g] || g}</div>`);
      lastGroup = g;
    }
    parts.push(`
      <div class="tbar-item${btn.visible ? '' : ' tbar-hidden'}" data-id="${btn.id}">
        <span class="tbar-icon"><i data-lucide="${btn.icon}"></i></span>
        <span class="tbar-label">${btn.label}</span>
        <div class="tbar-actions">
          <button class="tbar-toggle${btn.visible ? ' tbar-on' : ''}"
                  onclick="toggleToolbarBtn('${btn.id}')"
                  title="${btn.visible ? 'Ocultar' : 'Exibir'}">
            ${btn.visible ? '✓' : '○'}
          </button>
        </div>
      </div>`);
  });

  list.innerHTML = parts.join('');
  if (typeof lucide !== 'undefined')
    lucide.createIcons({ nodes: Array.from(list.querySelectorAll('[data-lucide]')) });
}

function toggleToolbarBtn(id) {
  const config = loadToolbarConfig();
  const btn = config.find(b => b.id === id);
  if (btn) btn.visible = !btn.visible;
  saveToolbarConfig(config);
  renderToolbarButtons();
  renderToolbarEditor();
  updatePreview();
}

function moveToolbarBtn(id, dir) {
  const config = loadToolbarConfig().sort((a, b) => a.order - b.order);
  const idx = config.findIndex(b => b.id === id);
  const target = idx + dir;
  if (target < 0 || target >= config.length) return;
  [config[idx].order, config[target].order] = [config[target].order, config[idx].order];
  saveToolbarConfig(config);
  renderToolbarButtons();
  renderToolbarEditor();
  updatePreview();
}

/* ── Preview ao vivo ── */
function updatePreview() {
  const preview = document.getElementById('pers-preview-box');
  if (!preview) return;

  const theme   = localStorage.getItem(LS_THEME) || 'default';
  const t       = THEMES.find(x => x.id === theme) || THEMES[0];
  const compact = localStorage.getItem(LS_DENSITY) === 'true';
  const view    = getViewMode();
  const bg      = t.dark ? '#000' : '#141416';
  const panel   = t.dark ? '#0c0c0e' : '#1c1c1f';
  const elevated= t.dark ? '#161618' : '#28282c';

  const toolbarBtns = loadToolbarConfig().sort((a,b)=>a.order-b.order).filter(b=>b.visible);
  const cardH = compact ? '32px' : '42px';
  const cardFs= compact ? '16px' : '20px';

  const sampleCFs = [[7,'#2e7d32'],[0,'#2e7d32'],[2,'#d49800'],[5,'#2e7d32']];

  const viewHTML = {
    cards: sampleCFs.map(([v,c]) =>
      `<div style="width:36px;height:${cardH};border-radius:5px;background:linear-gradient(135deg,${c},${c}bb);display:flex;align-items:center;justify-content:center;font-size:${cardFs};font-weight:800;color:#fff;flex-shrink:0;">${v}</div>`
    ).join(''),

    bars: `<div style="display:flex;flex-direction:column;gap:3px;width:100%;">
      ${sampleCFs.map(([v,c],i) => `
        <div style="display:flex;align-items:center;gap:4px;">
          <span style="font-size:8px;color:#888;width:14px;text-align:right;flex-shrink:0;">CF${i+1}</span>
          <div style="flex:1;height:10px;background:${elevated};border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${v===0?4:Math.min(100,v*12+8)}%;background:${c};border-radius:2px;transition:width 0.4s;"></div>
          </div>
          <span style="font-size:8px;font-weight:700;color:#eee;width:10px;">${v}</span>
        </div>`
      ).join('')}
    </div>`,

    bubbles: `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
      ${sampleCFs.map(([v,c]) => {
        const s = 28 + v * 3;
        return `<div style="width:${s}px;height:${s}px;border-radius:50%;background:linear-gradient(135deg,${c},${c}99);display:flex;align-items:center;justify-content:center;font-size:${Math.max(9,s*0.32)}px;font-weight:800;color:#fff;box-shadow:0 0 10px ${c}55;flex-shrink:0;">${v}</div>`;
      }).join('')}
    </div>`,

    heatmap: `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;width:100%;">
      ${sampleCFs.map(([v,c]) => {
        const op = Math.max(0.12, Math.min(1, v/8*0.9+0.1));
        return `<div style="height:32px;border-radius:4px;background:${c};opacity:${op};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;">${v}</div>`;
      }).join('')}
    </div>`,
  };

  preview.innerHTML = `
    <div style="background:${bg};border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);font-family:system-ui,sans-serif;">

      <!-- Header -->
      <div style="background:rgba(20,20,22,0.95);border-bottom:1px solid rgba(255,255,255,0.08);padding:7px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;align-items:center;height:18px;background:${elevated};border:1px solid rgba(255,255,255,0.1);border-radius:4px;overflow:hidden;flex-shrink:0;">
          ${(() => {
            let lastG = null;
            return toolbarBtns.map(btn => {
              const g = btn.group || 'util';
              const sep = (lastG !== null && g !== lastG)
                ? `<span style="width:2px;background:rgba(255,255,255,0.12);align-self:stretch;flex-shrink:0;"></span>`
                : '';
              lastG = g;
              const isIncident = g === 'incidente';
              return `${sep}<span style="padding:0 6px;font-size:7px;font-weight:700;color:${isIncident ? t.color : 'rgba(255,255,255,0.45)'};display:flex;align-items:center;height:100%;border-right:1px solid rgba(255,255,255,0.06);letter-spacing:0.3px;white-space:nowrap;">${btn.label.slice(0,7)}</span>`;
            }).join('');
          })()}
        </div>
        <div style="display:flex;gap:4px;align-items:center;">
          <span style="font-size:8px;color:#888;font-family:monospace;">4:59</span>
          <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 5px #22c55e88;display:block;"></span>
        </div>
      </div>

      <!-- Inbox bar -->
      <div style="background:${panel};border-bottom:1px solid rgba(255,255,255,0.06);padding:6px 10px;display:flex;align-items:center;gap:8px;">
        <span style="font-size:8px;font-weight:700;letter-spacing:1px;color:#aaa;">NOVAS ENTRADAS</span>
        <span style="background:${t.color};color:#fff;font-size:8px;font-weight:800;padding:1px 6px;border-radius:10px;">3</span>
      </div>

      <!-- Dashboard grid -->
      <div style="padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${['RAL','REC'].map((lbl,ri) => {
          const total = ri===0 ? 29 : 2;
          const gcol  = ri===0 && total>9 ? '#d49800' : '#2e7d32';
          return `
            <div>
              <div style="font-size:8px;font-weight:700;letter-spacing:2px;color:#888;text-align:center;margin-bottom:6px;">${lbl}</div>
              <div style="background:linear-gradient(135deg,${gcol},${gcol}bb);border-radius:5px;height:${cardH};display:flex;align-items:center;justify-content:center;font-size:${cardFs};font-weight:800;color:#fff;margin-bottom:7px;">${total}</div>
              <div style="display:flex;align-items:${view==='bars'?'stretch':'center'};gap:4px;flex-wrap:wrap;min-height:${view==='bars'?'60px':'auto'};">
                ${viewHTML[view] || viewHTML.cards}
              </div>
            </div>`;
        }).join('')}
      </div>

    </div>`;
}

