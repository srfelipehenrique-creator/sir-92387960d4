/* ── Backup / Restore completo de dados do usuário ── */

const BACKUP_LS_KEYS = [
  'sir_minhas_areas',
  'sir_presets',
  'minha_central_scripts',
  'minhas_variacoes_bw',
  'usuario_nome_bw',
  'cop_rede_premium_data',
  'sir_sound_enabled',
  'sir_high_contrast',
  'sir_compact',
  'cop_checklist_templates',
  'cop_checklist_active',
  'sir_table_state_v5',
  'sir_inbox_state_v5',
  'sir_ticket_state_v5',
];

function openBackupModal() {
  document.getElementById('backup-modal').classList.add('active');
  renderBackupInfo();
  /* Reset file input */
  const inp = document.getElementById('backup-file-input');
  const lbl = document.getElementById('backup-file-label');
  const btn = document.getElementById('btn-import-backup');
  if (inp) inp.value = '';
  if (lbl) lbl.textContent = 'Nenhum arquivo selecionado';
  if (btn) btn.disabled = true;
}

function closeBackupModal() {
  document.getElementById('backup-modal').classList.remove('active');
}

async function exportBackup() {
  const btn = document.getElementById('btn-export-backup');
  const origText = btn.textContent;
  btn.disabled = true; btn.textContent = 'Exportando...';

  try {
    const backup = { version: 2, ts: Date.now(), localStorage: {}, historico: [] };

    BACKUP_LS_KEYS.forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) backup.localStorage[k] = v;
    });

    backup.historico = await dbGetAllHistorico();

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `sir-backup-${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 400);

    showActionToast('Backup exportado com sucesso!', 'success');
    renderBackupInfo();
  } catch(e) {
    showActionToast('Erro ao exportar backup', 'error');
    console.error(e);
  } finally {
    btn.disabled = false; btn.textContent = origText;
  }
}

async function importBackup() {
  const fileInput = document.getElementById('backup-file-input');
  const file = fileInput.files[0];
  if (!file) return;

  const btn = document.getElementById('btn-import-backup');
  btn.disabled = true; btn.textContent = 'Restaurando...';

  try {
    const text   = await file.text();
    const backup = JSON.parse(text);

    if (!backup.version || !backup.ts) throw new Error('Arquivo inválido');

    /* Restore localStorage */
    if (backup.localStorage && typeof backup.localStorage === 'object') {
      Object.entries(backup.localStorage).forEach(([k, v]) => localStorage.setItem(k, v));
    }

    /* Restore historico → IndexedDB */
    if (Array.isArray(backup.historico) && backup.historico.length) {
      await dbClearHistorico();
      for (const h of backup.historico) {
        const { id: _id, ...data } = h;
        await dbSaveHistorico(data);
      }
    }

    const dt = new Date(backup.ts).toLocaleString('pt-BR');
    showActionToast(`Backup de ${dt} restaurado! Recarregando...`, 'success');
    setTimeout(() => location.reload(), 1800);
  } catch(e) {
    showActionToast('Erro ao restaurar: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = 'Restaurar';
  }
}

function handleBackupFileSelect() {
  const fileInput = document.getElementById('backup-file-input');
  const btn       = document.getElementById('btn-import-backup');
  const label     = document.getElementById('backup-file-label');
  const file      = fileInput.files[0];
  if (!file) return;
  label.textContent = file.name;
  btn.disabled = false;
}

function renderBackupInfo() {
  const el = document.getElementById('backup-info');
  if (!el) return;

  const totalLS = BACKUP_LS_KEYS.filter(k => localStorage.getItem(k) !== null).length;
  const scripts = JSON.parse(localStorage.getItem('minha_central_scripts') || '[]').length;
  const areas   = JSON.parse(localStorage.getItem('sir_minhas_areas') || '[]').length;
  const presets = JSON.parse(localStorage.getItem('sir_presets') || '[]').length;

  dbGetAllHistorico().then(hist => {
    el.innerHTML = `
      <div class="backup-stat"><span>Áreas salvas</span><strong>${areas}</strong></div>
      <div class="backup-stat"><span>Predefinições</span><strong>${presets}</strong></div>
      <div class="backup-stat"><span>Textos prontos</span><strong>${scripts}</strong></div>
      <div class="backup-stat"><span>Históricos</span><strong>${hist.length}</strong></div>
      <div class="backup-stat"><span>Chaves de dados</span><strong>${totalLS} / ${BACKUP_LS_KEYS.length}</strong></div>
    `;
  });
}
