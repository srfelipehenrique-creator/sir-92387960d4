/* ── Cronômetro / Temporizador ── */

let timerMode       = 'cronometro';

/* cronômetro */
let timerSeconds    = 0;
let timerRunning    = false;
let timerInterval   = null;

/* temporizador */
let timerCdInitial  = 600;   // segundos (padrão: 10 min)
let timerCdRemaining = 600;
let timerCdRunning  = false;
let timerCdInterval = null;
let timerCdFired    = false;

/* ── Abrir / fechar / drag ── */
function toggleTimerFloat() {
  document.getElementById('timer-float')?.classList.toggle('visible');
}

function initTimerDrag() {
  const handle = document.getElementById('timer-drag-handle');
  const el     = document.getElementById('timer-float');
  if (!handle || !el) return;
  let ox = 0, oy = 0;
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    const onMove = ev => {
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.left = Math.max(0, Math.min(ev.clientX - ox, window.innerWidth  - el.offsetWidth))  + 'px';
      el.style.top  = Math.max(0, Math.min(ev.clientY - oy, window.innerHeight - el.offsetHeight)) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}

/* ── Troca de modo ── */
function switchTimerMode(mode) {
  timerMode = mode;
  document.getElementById('tab-crono')?.classList.toggle('tmtab-active', mode === 'cronometro');
  document.getElementById('tab-timer')?.classList.toggle('tmtab-active', mode === 'temporizador');
  document.getElementById('timer-crono-body').style.display  = mode === 'cronometro'  ? '' : 'none';
  document.getElementById('timer-cd-body').style.display     = mode === 'temporizador' ? '' : 'none';
}

/* ════════════════════════════════
   CRONÔMETRO
════════════════════════════════ */
function timerStartPause() {
  if (timerRunning) {
    clearInterval(timerInterval); timerInterval = null; timerRunning = false;
    const btn = document.getElementById('timer-start-btn');
    if (btn) { btn.textContent = 'Retomar'; btn.className = 'timer-btn t-start'; }
  } else {
    timerRunning = true;
    const btn = document.getElementById('timer-start-btn');
    if (btn) { btn.textContent = 'Pausar'; btn.className = 'timer-btn t-pause'; }
    timerInterval = setInterval(() => { timerSeconds++; _updateCronoDisplay(); }, 1000);
  }
}

function timerReset() {
  clearInterval(timerInterval); timerInterval = null; timerRunning = false; timerSeconds = 0;
  const btn = document.getElementById('timer-start-btn');
  if (btn) { btn.textContent = 'Iniciar'; btn.className = 'timer-btn t-start'; }
  const disp = document.getElementById('timer-display');
  if (disp) { disp.textContent = '00:00'; disp.className = 'timer-display'; }
}

function _updateCronoDisplay() {
  const disp = document.getElementById('timer-display');
  if (!disp) return;
  const h = Math.floor(timerSeconds / 3600);
  const m = Math.floor((timerSeconds % 3600) / 60);
  const s = timerSeconds % 60;
  disp.textContent = h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}`
    : `${pad(m)}:${pad(s)}`;
  disp.className = `timer-display${timerRunning ? ' running' : ''}`;
}

/* ════════════════════════════════
   TEMPORIZADOR
════════════════════════════════ */
function adjustCountdown(delta) {
  if (timerCdRunning) return;
  timerCdInitial = Math.max(1, Math.min(5999, timerCdInitial + delta));
  timerCdRemaining = timerCdInitial;
  timerCdFired = false;
  _renderCdSetup();
}

function timerCdStartPause() {
  if (timerCdInitial === 0) return;

  if (timerCdFired) { timerCdReset(); return; }

  if (timerCdRunning) {
    clearInterval(timerCdInterval); timerCdInterval = null; timerCdRunning = false;
    const btn = document.getElementById('timer-cd-start-btn');
    if (btn) { btn.textContent = 'Retomar'; btn.className = 'timer-btn t-start'; }
    _showCdRunning(false);
  } else {
    timerCdRunning = true;
    const btn = document.getElementById('timer-cd-start-btn');
    if (btn) { btn.textContent = 'Pausar'; btn.className = 'timer-btn t-pause'; }
    _showCdRunning(true);
    _updateCdDisplay();
    timerCdInterval = setInterval(() => {
      timerCdRemaining = Math.max(0, timerCdRemaining - 1);
      _updateCdDisplay();
      if (timerCdRemaining <= 0) {
        clearInterval(timerCdInterval); timerCdInterval = null; timerCdRunning = false;
        timerCdFired = true;
        const btn2 = document.getElementById('timer-cd-start-btn');
        if (btn2) { btn2.textContent = 'Reset'; btn2.className = 'timer-btn t-reset'; }
        _fireCdAlert();
      }
    }, 1000);
  }
}

function timerCdReset() {
  clearInterval(timerCdInterval); timerCdInterval = null;
  timerCdRunning = false; timerCdFired = false;
  timerCdRemaining = timerCdInitial;
  const btn = document.getElementById('timer-cd-start-btn');
  if (btn) { btn.textContent = 'Iniciar'; btn.className = 'timer-btn t-start'; }
  const disp = document.getElementById('timer-cd-display');
  if (disp) disp.className = 'timer-display';
  _showCdRunning(false);
  _renderCdSetup();
}

function _showCdRunning(running) {
  const setup = document.getElementById('timer-cd-setup');
  const disp  = document.getElementById('timer-cd-display');
  if (setup) setup.style.display = running ? 'none' : '';
  if (disp)  disp.style.display  = running ? ''     : 'none';
}

function _renderCdSetup() {
  const m = Math.floor(timerCdInitial / 60);
  const s = timerCdInitial % 60;
  const mEl = document.getElementById('cd-min-val');
  const sEl = document.getElementById('cd-sec-val');
  if (mEl) mEl.textContent = pad(m);
  if (sEl) sEl.textContent = pad(s);
}

function _updateCdDisplay() {
  const disp = document.getElementById('timer-cd-display');
  if (!disp) return;
  const rem = timerCdRemaining;
  const h   = Math.floor(rem / 3600);
  const m   = Math.floor((rem % 3600) / 60);
  const s   = rem % 60;
  disp.textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  if (!timerCdFired) disp.className = `timer-display${timerCdRunning ? ' running' : ''}`;
}

function _fireCdAlert() {
  const disp = document.getElementById('timer-cd-display');
  if (disp) { disp.textContent = '00:00'; disp.className = 'timer-display alerting'; }
  showActionToast('Temporizador — tempo esgotado!', 'error');
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28, 0.56, 0.84].forEach((delay, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = i % 2 === 0 ? 880 : 660;
      g.gain.setValueAtTime(0.22, ctx.currentTime + delay);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.22);
      o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + 0.22);
    });
    setTimeout(() => ctx.close(), 1400);
  } catch(e) {}
}

function pad(n) { return String(n).padStart(2, '0'); }
