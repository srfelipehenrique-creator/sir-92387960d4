const SCRIPTS_KEY = 'minha_central_scripts';
let scriptBank = JSON.parse(localStorage.getItem(SCRIPTS_KEY)) || [];
let scriptEditIdx = -1;
let scriptCatFilter = 'Todos';

function openScripts() {
  renderScriptsGrid();
  document.getElementById('scripts-modal').classList.add('active');
  document.getElementById('scripts-nome').focus();
}

function closeScripts() {
  document.getElementById('scripts-modal').classList.remove('active');
}

function renderScriptsGrid() {
  const grid    = document.getElementById('scripts-grid');
  const catsEl  = document.getElementById('scripts-cats');
  const search  = (document.getElementById('scripts-search')?.value || '').toLowerCase().trim();
  const cats    = ['Todos', ...new Set(scriptBank.map(s => s.categoria).filter(Boolean))];
  if (catsEl) {
    catsEl.innerHTML = cats.map(c =>
      `<button class="scripts-cat-chip${c === scriptCatFilter ? ' active' : ''}" onclick="setScriptCat('${escapeHtml(c)}')">${escapeHtml(c)}</button>`
    ).join('');
  }
  let filtered = scriptBank.map((s, i) => ({ ...s, _idx: i }));
  if (scriptCatFilter !== 'Todos') filtered = filtered.filter(s => s.categoria === scriptCatFilter);
  if (search) filtered = filtered.filter(s => s.nome.toLowerCase().includes(search));
  if (!filtered.length) { grid.innerHTML = `<div class="scripts-empty-state">Nenhum script encontrado.</div>`; return; }
  grid.innerHTML = filtered.map(s => `
    <div class="script-card" id="script-card-${s._idx}">
      <button class="script-copy-btn" onclick="copyScript(${s._idx})">${escapeHtml(s.nome)}${s.categoria ? `<span style="font-size:9px;color:var(--text-dim);display:block;margin-top:2px;">${escapeHtml(s.categoria)}</span>` : ''}</button>
      <button class="script-edit-btn" onclick="editScript(${s._idx})" title="Editar">✏</button>
      <button class="script-del-btn" onclick="deleteScript(${s._idx})" title="Excluir">×</button>
    </div>`).join('');
}

function setScriptCat(cat) { scriptCatFilter = cat; renderScriptsGrid(); }

function saveScript() {
  const nomeEl  = document.getElementById('scripts-nome');
  const textoEl = document.getElementById('scripts-texto');
  const catEl   = document.getElementById('scripts-categoria');
  const nome    = nomeEl.value.trim();
  const texto   = textoEl.value.trim();
  const cat     = catEl ? catEl.value.trim() : '';
  if (!nome || !texto) return;
  if (scriptEditIdx >= 0) {
    scriptBank[scriptEditIdx] = { nome, texto, categoria: cat };
    scriptEditIdx = -1;
    document.getElementById('scripts-edit-badge').style.display = 'none';
    document.getElementById('btn-scripts-save').textContent = 'Salvar';
    document.getElementById('btn-scripts-cancel').style.display = 'none';
    document.querySelector('.scripts-form-panel')?.classList.remove('scripts-form-editing');
    showActionToast('Script atualizado', 'success');
  } else {
    scriptBank.push({ nome, texto, categoria: cat });
    showActionToast('Script salvo', 'success');
  }
  localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scriptBank));
  nomeEl.value = ''; textoEl.value = '';
  if (catEl) catEl.value = '';
  nomeEl.focus(); renderScriptsGrid();
}

function editScript(idx) {
  const s = scriptBank[idx];
  if (!s) return;
  scriptEditIdx = idx;
  document.getElementById('scripts-nome').value  = s.nome;
  document.getElementById('scripts-texto').value = s.texto;
  const catEl = document.getElementById('scripts-categoria');
  if (catEl) catEl.value = s.categoria || '';
  document.getElementById('scripts-edit-badge').style.display = 'block';
  document.getElementById('btn-scripts-save').textContent = 'Salvar Edição';
  document.getElementById('btn-scripts-cancel').style.display = 'block';
  document.querySelector('.scripts-form-panel')?.classList.add('scripts-form-editing');
  document.getElementById('scripts-nome').focus();
}

function cancelEditScript() {
  scriptEditIdx = -1;
  document.getElementById('scripts-nome').value  = '';
  document.getElementById('scripts-texto').value = '';
  const catEl = document.getElementById('scripts-categoria');
  if (catEl) catEl.value = '';
  document.getElementById('scripts-edit-badge').style.display = 'none';
  document.getElementById('btn-scripts-save').textContent = 'Salvar';
  document.getElementById('btn-scripts-cancel').style.display = 'none';
  document.querySelector('.scripts-form-panel')?.classList.remove('scripts-form-editing');
}

function copyScript(idx) {
  const script = scriptBank[idx];
  if (!script) return;
  navigator.clipboard.writeText(script.texto).then(() => {
    const btn = document.querySelector(`#script-card-${idx} .script-copy-btn`);
    if (!btn) return;
    btn.classList.add('copied'); btn.textContent = 'Copiado';
    setTimeout(() => { btn.classList.remove('copied'); btn.textContent = script.nome; }, 900);
  });
}

function deleteScript(idx) {
  scriptBank.splice(idx, 1);
  localStorage.setItem(SCRIPTS_KEY, JSON.stringify(scriptBank));
  renderScriptsGrid();
}
