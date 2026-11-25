let historicoBank = [];

async function initHistorico() {
  await dbMigrateHistoricoFromLS();
  historicoBank = await dbGetAllHistorico();
}

function openHistorico() {
  renderHistoricoList();
  document.getElementById('historico-modal').classList.add('active');
  document.getElementById('hist-designacao').focus();
}

function closeHistorico() {
  document.getElementById('historico-modal').classList.remove('active');
}

function renderHistoricoList() {
  const list      = document.getElementById('hist-list');
  const countEl   = document.getElementById('hist-count');
  const exportBtn = document.getElementById('btn-hist-export');
  const search    = (document.getElementById('hist-search')?.value || '').toLowerCase().trim();

  const sorted   = [...historicoBank].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  let filtered   = sorted;
  if (search) filtered = filtered.filter(h => h.designacao.toLowerCase().includes(search) || (h.observacao||'').toLowerCase().includes(search));

  if (countEl)   countEl.textContent = filtered.length;
  if (exportBtn) exportBtn.disabled  = !historicoBank.length;

  if (!filtered.length) {
    list.innerHTML = `<div class="historico-list-empty">${search ? 'Nenhum histórico encontrado para "'+escapeHtml(search)+'".' : 'Nenhum histórico salvo.<br>Adicione um pelo painel ao lado.'}</div>`;
    return;
  }
  list.innerHTML = filtered.map(h => {
    const preview = (h.texto || '').substring(0, 140);
    return `<div class="historico-item" id="hist-item-${h.id}">
      <div class="historico-item-header">
        <div class="historico-item-titles">
          <div class="historico-item-desig">${escapeHtml(h.designacao)}</div>
          ${h.observacao ? `<div class="historico-item-obs">${escapeHtml(h.observacao)}</div>` : ''}
        </div>
        <div class="historico-item-actions">
          <button class="btn-hist-expand" onclick="toggleHistoricoExpand(${h.id})" title="Expandir">▾</button>
          <button class="btn-hist-edit"   onclick="toggleHistoricoEdit(${h.id})"   title="Editar">✏</button>
          <button class="btn-hist-del"    onclick="deletarHistorico(${h.id})"      title="Excluir">×</button>
        </div>
      </div>
      <div class="historico-item-preview">${escapeHtml(preview)}</div>
      <div class="historico-item-full">${escapeHtml(h.texto || '')}</div>
      <div class="historico-item-edit-form" id="hist-edit-form-${h.id}">
        <input type="text" class="historico-input" id="hist-edit-desig-${h.id}" value="${escapeHtml(h.designacao)}" placeholder="Designação">
        <input type="text" class="historico-input" id="hist-edit-obs-${h.id}"   value="${escapeHtml(h.observacao||'')}" placeholder="Observação">
        <textarea class="historico-textarea" id="hist-edit-texto-${h.id}" placeholder="Texto">${escapeHtml(h.texto||'')}</textarea>
        <div class="hist-edit-actions">
          <button class="btn-hist-save-edit"   onclick="salvarEdicaoHistorico(${h.id})">Salvar</button>
          <button class="btn-hist-cancel-edit" onclick="cancelarEdicaoHistorico(${h.id})">Cancelar</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function toggleHistoricoExpand(id) {
  const item = document.getElementById(`hist-item-${id}`);
  if (!item) return;
  item.classList.toggle('expanded');
  const btn = item.querySelector('.btn-hist-expand');
  if (btn) btn.textContent = item.classList.contains('expanded') ? '▴' : '▾';
}

function toggleHistoricoEdit(id) {
  const form = document.getElementById(`hist-edit-form-${id}`);
  if (!form) return;
  const open = form.classList.toggle('open');
  if (open) { const inp = document.getElementById(`hist-edit-desig-${id}`); if (inp) inp.focus(); }
}

async function salvarEdicaoHistorico(id) {
  const desig = document.getElementById(`hist-edit-desig-${id}`)?.value.trim();
  const obs   = document.getElementById(`hist-edit-obs-${id}`)?.value.trim();
  const texto = document.getElementById(`hist-edit-texto-${id}`)?.value.trim();
  if (!desig || !texto) return;
  const entry = historicoBank.find(h => h.id === id);
  if (!entry) return;
  Object.assign(entry, { designacao: desig, observacao: obs, texto });
  await dbUpdateHistorico(entry);
  showActionToast('Histórico atualizado', 'success');
  renderHistoricoList();
}

function cancelarEdicaoHistorico(id) {
  const form = document.getElementById(`hist-edit-form-${id}`);
  if (form) form.classList.remove('open');
}

async function salvarHistorico() {
  const desigEl = document.getElementById('hist-designacao');
  const obsEl   = document.getElementById('hist-observacao');
  const textoEl = document.getElementById('hist-texto');
  const desig   = desigEl.value.trim();
  const obs     = obsEl.value.trim();
  const texto   = textoEl.value.trim();
  if (!desig || !texto) return;
  const newId = await dbSaveHistorico({ designacao: desig, observacao: obs, texto, ts: Date.now() });
  historicoBank.unshift({ id: newId, designacao: desig, observacao: obs, texto, ts: Date.now() });
  desigEl.value = ''; obsEl.value = ''; textoEl.value = '';
  desigEl.focus();
  renderHistoricoList();
  showActionToast('Histórico salvo', 'success');
}

async function deletarHistorico(id) {
  await dbDeleteHistorico(id);
  historicoBank = historicoBank.filter(h => h.id !== id);
  renderHistoricoList();
}

async function exportarHistoricos() {
  if (!historicoBank.length) return;
  const sanitize = s => (s || 'historico').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 80).trim() || 'historico';

  if (typeof JSZip !== 'undefined') {
    const zip = new JSZip();
    const usedNames = {};
    historicoBank.forEach(h => {
      let nome = sanitize(h.designacao);
      usedNames[nome] = (usedNames[nome] || 0) + 1;
      if (usedNames[nome] > 1) nome = `${nome}_${usedNames[nome]}`;
      const header = h.observacao ? `DESIGNAÇÃO: ${h.designacao}\nOBSERVAÇÃO: ${h.observacao}\n\n` : `DESIGNAÇÃO: ${h.designacao}\n\n`;
      zip.file(`${nome}.txt`, header + h.texto);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historicos_cop_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.zip`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
    return;
  }
  historicoBank.forEach(h => {
    const nome   = sanitize(h.designacao);
    const header = h.observacao ? `DESIGNAÇÃO: ${h.designacao}\nOBSERVAÇÃO: ${h.observacao}\n\n` : `DESIGNAÇÃO: ${h.designacao}\n\n`;
    const blob = new Blob([header + h.texto], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${nome}.txt`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 300);
  });
}
