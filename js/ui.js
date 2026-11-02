let soundEnabled = JSON.parse(localStorage.getItem('sir_sound_enabled') ?? 'true');
let lastInboxCount = 0;

function showActionToast(msg, type = 'success') {
  const wrap = document.getElementById('action-toasts');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `action-toast ${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 320); }, 2800);
}

function updatePageTitle() {
  const n = appState.inboxItems.length;
  document.title = n > 0 ? `(${n}) SIR · Dashboard` : 'SIR · Dashboard';
}

function playInboxSound() {
  const n = appState.inboxItems.length;
  if (!soundEnabled || n <= lastInboxCount) { lastInboxCount = n; return; }
  lastInboxCount = n;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 600);
  } catch(e) {}
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('sir_sound_enabled', JSON.stringify(soundEnabled));
  const icon = document.getElementById('sound-icon');
  if (icon) {
    icon.setAttribute('data-lucide', soundEnabled ? 'volume-2' : 'volume-x');
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [icon.closest('button')] });
  }
  showActionToast(soundEnabled ? 'Alerta sonoro ativado' : 'Alerta sonoro desativado');
}

function toggleContrast() {
  document.body.classList.toggle('high-contrast');
  localStorage.setItem('sir_high_contrast', document.body.classList.contains('high-contrast'));
  showActionToast(document.body.classList.contains('high-contrast') ? 'Alto contraste ativado' : 'Alto contraste desativado');
}

function toggleCompact() {
  document.body.classList.toggle('compact');
  localStorage.setItem('sir_compact', document.body.classList.contains('compact'));
  showActionToast(document.body.classList.contains('compact') ? 'Modo compacto ativado' : 'Modo compacto desativado');
}

function dismissToast() {
  const t = document.getElementById('warning-toast');
  if (!t) return;
  t.classList.add('toast-out');
  setTimeout(() => t.remove(), 320);
}

function setOfflineBanner(offline) {
  const el = document.getElementById('offline-banner');
  if (!el) return;
  el.classList.toggle('show', offline);
}

/* ── PWA install prompt ── */
let _pwaInstallEvent = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaInstallEvent = e;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = '';
});

window.addEventListener('appinstalled', () => {
  _pwaInstallEvent = null;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = 'none';
  showActionToast('App instalado com sucesso!', 'success');
});

function triggerPWAInstall() {
  if (!_pwaInstallEvent) return;
  _pwaInstallEvent.prompt();
  _pwaInstallEvent.userChoice.then(choice => {
    if (choice.outcome === 'accepted') showActionToast('Instalando app...', 'success');
    _pwaInstallEvent = null;
  });
}

function initPreferences() {
  if (localStorage.getItem('sir_high_contrast') === 'true') document.body.classList.add('high-contrast');
  if (localStorage.getItem('sir_compact') === 'true') document.body.classList.add('compact');
  if (!soundEnabled) {
    const icon = document.getElementById('sound-icon');
    if (icon) icon.setAttribute('data-lucide', 'volume-x');
  }
}
