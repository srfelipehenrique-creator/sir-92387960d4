let userSavedAreas = JSON.parse(localStorage.getItem('sir_minhas_areas')) || [];
let userPresets    = JSON.parse(localStorage.getItem('sir_presets'))    || [];

function getUserSavedAreas() { return userSavedAreas; }
function getUserPresets()    { return userPresets; }

function openSettings() {
  renderPresetsRow();
  renderAreasList();
  document.getElementById('settings-modal').classList.add('active');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('active');
}

function renderPresetsRow() {
  const row = document.getElementById('presets-row');
  if (!userPresets.length) {
    row.innerHTML = '<span class="presets-empty">Nenhuma predefinição salva.</span>';
    return;
  }
  row.innerHTML = userPresets.map((p, idx) => `
    <div class="preset-chip" onclick="applyPreset(${idx})">
      <span class="preset-chip-name">${escapeHtml(p.name)}</span>
      <button class="preset-del" onclick="deletePreset(event,${idx})" title="Excluir">×</button>
    </div>`).join('');
}

function renderAreasList() {
  const container = document.getElementById('settings-cf-list');
  if (!container) return;
  let html = '';
  for (const reg in REGIONS) {
    const cfs = Object.keys(REGIONS[reg]);
    const allSel = cfs.every(cf => userSavedAreas.includes(cf));
    html += `
      <div class="region-block">
        <div class="region-block-hd">
          <span class="region-block-name">${escapeHtml(reg)}</span>
          <button class="btn-region-all" onclick="toggleAllInRegion('${escapeHtml(reg)}', this)">
            ${allSel ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
        </div>
        <div class="region-cfs-grid">`;
    for (const cf in REGIONS[reg]) {
      const checked = userSavedAreas.includes(cf) ? 'checked' : '';
      const name = (typeof CF_NAMES !== 'undefined' && CF_NAMES[cf]) ? CF_NAMES[cf] : '';
      html += `
          <label class="cf-checkbox-label cf-checkbox-rich">
            <input type="checkbox" class="cf-checkbox" value="${cf}" ${checked}>
            <div class="cf-check-info">
              <span class="cf-check-code">${cf}</span>
              ${name ? `<span class="cf-check-name">${escapeHtml(name)}</span>` : ''}
            </div>
          </label>`;
    }
    html += `</div></div>`;
  }
  container.innerHTML = html;
}

function toggleAllInRegion(reg, btn) {
  const cfs = Object.keys(REGIONS[reg] || {});
  const checkboxes = cfs.map(cf => document.querySelector(`.cf-checkbox[value="${cf}"]`)).filter(Boolean);
  const allChecked = checkboxes.every(cb => cb.checked);
  checkboxes.forEach(cb => { cb.checked = !allChecked; });
  if (btn) btn.textContent = allChecked ? 'Selecionar todos' : 'Desmarcar todos';
}

function applyPreset(idx) {
  const preset = userPresets[idx];
  if (!preset) return;
  document.querySelectorAll('.cf-checkbox').forEach(cb => { cb.checked = preset.areas.includes(cb.value); });
}

function deletePreset(e, idx) {
  e.stopPropagation();
  userPresets.splice(idx, 1);
  localStorage.setItem('sir_presets', JSON.stringify(userPresets));
  renderPresetsRow();
}

function startSavePreset() {
  const wrap = document.getElementById('preset-name-form-wrap');
  if (wrap.querySelector('.preset-name-form')) return;
  wrap.innerHTML = `
    <div class="preset-name-form">
      <input type="text" id="preset-name-input" class="preset-name-input"
             maxlength="30" placeholder="Nome da predefinição..." autocomplete="off">
      <button class="btn-settings-act" onclick="confirmSavePreset()">Salvar</button>
      <button class="btn-settings-act" onclick="cancelSavePreset()">×</button>
    </div>`;
  const inp = document.getElementById('preset-name-input');
  inp.focus();
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmSavePreset();
    if (e.key === 'Escape') cancelSavePreset();
  });
}

function confirmSavePreset() {
  const inp  = document.getElementById('preset-name-input');
  const name = inp ? inp.value.trim() : '';
  if (!name) { cancelSavePreset(); return; }
  const areas = Array.from(document.querySelectorAll('.cf-checkbox:checked')).map(cb => cb.value);
  if (!areas.length) { cancelSavePreset(); return; }
  userPresets.push({ name, areas });
  localStorage.setItem('sir_presets', JSON.stringify(userPresets));
  cancelSavePreset();
  renderPresetsRow();
}

function cancelSavePreset() {
  document.getElementById('preset-name-form-wrap').innerHTML = '';
}

function deselectAll() {
  document.querySelectorAll('.cf-checkbox').forEach(cb => { cb.checked = false; });
}

function saveSettings(onSaved) {
  userSavedAreas = Array.from(document.querySelectorAll('.cf-checkbox:checked')).map(cb => cb.value);
  localStorage.setItem('sir_minhas_areas', JSON.stringify(userSavedAreas));
  closeSettings();
  renderSelectedCfTags();
  if (onSaved) onSaved();
}

function renderSelectedCfTags() {
  const container = document.getElementById('selected-cfs');
  if (!container) return;
  if (!userSavedAreas.length) { container.innerHTML = ''; return; }
  container.innerHTML = userSavedAreas
    .map(cf => `<span class="selected-cf-tag" title="Área monitorada">${escapeHtml(cf)}</span>`)
    .join('');
}
