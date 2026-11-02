/* Initialization — all other modules are loaded as globals via <script> tags */

/* Register Service Worker (only works on http/https, silently ignored on file://) */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e));
}

function applySettings() {
  saveSettings(() => { resetForReload(); loadAll(getUserSavedAreas()); });
}

/* Keyboard shortcuts */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal(); closeSettings(); closeScripts(); closeTorpedos();
    closeMascaras(); closeHistorico();
    closeBackupModal(); closeSiglas(); closePersonalizacao();
    if (typeof closeQualidade === 'function') closeQualidade();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  /* Script/historico keyboard shortcuts */
  const nomeInput  = document.getElementById('scripts-nome');
  const textoInput = document.getElementById('scripts-texto');
  if (nomeInput)  nomeInput.addEventListener('keydown',  e => { if (e.key === 'Enter') { e.preventDefault(); textoInput?.focus(); } });
  if (textoInput) textoInput.addEventListener('keydown', e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); saveScript(); } });

  document.addEventListener('keydown', e => {
  });

  const histDesig = document.getElementById('hist-designacao');
  const histObs   = document.getElementById('hist-observacao');
  const histTexto = document.getElementById('hist-texto');
  if (histDesig) histDesig.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); histObs?.focus(); } });
  if (histObs)   histObs.addEventListener('keydown',   e => { if (e.key === 'Enter') { e.preventDefault(); histTexto?.focus(); } });
  if (histTexto) histTexto.addEventListener('keydown', e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); salvarHistorico(); } });

  const mCustom = document.getElementById('m_customText');
  const mNewVar = document.getElementById('m_newVariation');
  if (mCustom) mCustom.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); copiarMascaraCustom(); } });
  if (mNewVar) mNewVar.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); adicionarMascaraVariacao(); } });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !e.target.hasAttribute('contenteditable')) return;
    if (!document.getElementById('torpedo-notepad')?.contains(e.target)) return;
    e.preventDefault();
    const campos = Array.from(document.querySelectorAll('#torpedo-notepad [contenteditable="true"]'));
    const idx = campos.indexOf(e.target);
    if (idx > -1 && idx < campos.length - 1) campos[idx + 1].focus();
    else e.target.blur();
  });

  /* PWA shortcut: ?refresh=1 forces immediate refresh */
  if (new URLSearchParams(location.search).get('refresh') === '1') {
    history.replaceState(null, '', location.pathname);
    setTimeout(() => loadNow(getUserSavedAreas()), 1200);
  }

  /* Boot sequence */
  carregarCacheTorpedo();
  iniciarTimerTorpedo();
  initTheme();
  initPreferences();
  renderToolbarButtons();
  cleanupStorage();
  loadTicketStates();
  initTimerDrag();

  if (typeof lucide !== 'undefined') lucide.createIcons();

  /* Inicializa sistema de módulos fixados (wraps de open/close + estado dos botões) */
  if (typeof initPinnedSystem === 'function') initPinnedSystem();

  setTimeout(dismissToast, 5000);

  /* Init IndexedDB historico (migrates from localStorage), then load data */
  initHistorico().then(() => {
    loadAll(getUserSavedAreas());
    /* Restaura módulos fixados após o DB estar pronto */
    if (typeof restorePinnedModules === 'function') restorePinnedModules();
  });
});
