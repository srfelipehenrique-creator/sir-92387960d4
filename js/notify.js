/* ══════════════════════════════════════════════════════════════
   Notificações de RAL/REC novas (somente das suas Minhas Áreas)
   - Pop-up dentro do app para cada ticket novo que entrar no Inbox
   - Notificação do sistema quando o SIR está aberto em segundo plano
     (aba escondida no PC, app minimizado no celular)
   - Botão de sino no topo: liga/desliga (salvo em 'sir_notify')
   Usa a mesma detecção do Inbox: só tickets novos, das suas áreas,
   que você ainda não marcou como "Ciente".
   ══════════════════════════════════════════════════════════════ */

const LS_NOTIFY      = 'sir_notify';          // 'on' | 'off'
const _ntNarrow = () => !!(window.matchMedia && matchMedia('(max-width: 640px)').matches);
const NOTIFY_MAX_PC = 3, NOTIFY_MAX_PHONE = 2;  // pop-ups individuais por atualização
const NOTIFY_TIMEOUT = 25000;                 // some sozinho após 25 s (pausa ao passar o mouse/tocar)

function notifyEnabled() { try { return localStorage.getItem(LS_NOTIFY) !== 'off'; } catch (e) { return true; } }

function _ntEsc(s) { return typeof escapeHtml === 'function' ? escapeHtml(s) : String(s ?? ''); }

function _ntSla(item, isRal) {
  if (typeof calcSla !== 'function') return null;
  const r = calcSla(item.abertura || '', isRal);
  if (!r) return null;
  const fmt = ms => { const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`; };
  if (r.remaining <= 0) return { cls: 'lost', txt: `SLA perdido +${fmt(-r.remaining)}` };
  return { cls: r.remaining < 3600000 ? 'urgent' : r.remaining < 7200000 ? 'warn' : 'ok', txt: `SLA ${fmt(r.remaining)}` };
}

function _ntContainer() {
  let c = document.getElementById('notify-stack');
  if (!c) {
    c = document.createElement('div');
    c.id = 'notify-stack';
    c.setAttribute('aria-live', 'polite');
    document.body.appendChild(c);
  }
  return c;
}

function _ntRemove(card) {
  if (!card || card._closing) return;
  card._closing = true;
  clearTimeout(card._t);
  card.classList.add('nt-out');
  setTimeout(() => card.remove(), 260);
}

function _ntArmTimer(card) {
  clearTimeout(card._t);
  card._left = card._left ?? NOTIFY_TIMEOUT;
  card._start = Date.now();
  card.style.setProperty('--nt-dur', card._left + 'ms');
  card.classList.remove('nt-paused');
  card._t = setTimeout(() => _ntRemove(card), card._left);
}
function _ntPause(card) {
  if (card._closing) return;
  clearTimeout(card._t);
  card._left = Math.max(1500, card._left - (Date.now() - card._start));
  card.classList.add('nt-paused');
}

function _ntShowCard(html, onBuild) {
  const stack = _ntContainer();
  const card = document.createElement('div');
  card.className = 'nt-card';
  card.innerHTML = html + '<div class="nt-progress"></div>';
  stack.prepend(card);
  /* No máximo 4 na tela */
  Array.from(stack.children).slice(_ntNarrow() ? 3 : 4).forEach(_ntRemove);
  card.addEventListener('mouseenter', () => _ntPause(card));
  card.addEventListener('mouseleave', () => _ntArmTimer(card));
  card.addEventListener('touchstart', () => _ntPause(card), { passive: true });
  card.querySelector('.nt-close')?.addEventListener('click', () => _ntRemove(card));
  if (onBuild) onBuild(card);
  requestAnimationFrame(() => card.classList.add('nt-in'));
  _ntArmTimer(card);
  return card;
}

/* Abre a lista do CF com o ticket já filtrado */
function notifyOpenTicket(cf, tk, ticket) {
  const isRal = tk === 'ral';
  const title = typeof _cfTitle === 'function' ? _cfTitle(tk, cf) : `${isRal ? 'RAL' : 'REC'} · ${cf}`;
  openModal(cf, isRal, title);
  setTimeout(() => {
    const f = document.getElementById('modal-filter-input');
    if (f && ticket) { f.value = ticket; if (typeof filterModalTable === 'function') filterModalTable(); }
  }, 120);
}

function _ntTicketCard(item) {
  const tk = item.typeKey, isRal = tk === 'ral';
  const sla = _ntSla(item, isRal);
  const extraLbl = isRal ? 'Tipo' : 'Cliente';
  const html = `
    <div class="nt-head">
      <span class="nt-badge nt-${tk}">${isRal ? 'RAL' : 'REC'} nova</span>
      <span class="cf-tag">${_ntEsc(item.cfOrigem)}</span>
      ${sla ? `<span class="nt-sla nt-sla-${sla.cls}">${_ntEsc(sla.txt)}</span>` : ''}
      <button class="nt-close" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="nt-ticket">${_ntEsc(item.ticket || 'N/D')}</div>
    <div class="nt-desig">${_ntEsc(item.designacao || '—')}</div>
    <div class="nt-meta">
      ${item.extra && item.extra !== 'N/D' ? `<span>${extraLbl}: ${_ntEsc(item.extra)}</span>` : ''}
      ${item.abertura ? `<span>Abertura ${_ntEsc(item.abertura.replace(' - ', ' · '))}</span>` : ''}
    </div>
    <div class="nt-actions">
      <button type="button" class="nt-btn nt-primary" data-act="ver">Ver</button>
      <button type="button" class="nt-btn nt-copy" data-act="copiar">Copiar</button>
      <button type="button" class="nt-btn" data-act="ciente">Ciente</button>
    </div>`;
  _ntShowCard(html, card => {
    card.addEventListener('click', async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      if (act === 'ver') { notifyOpenTicket(item.cfOrigem, tk, item.ticket); _ntRemove(card); }
      if (act === 'ciente') { if (typeof acknowledgeInboxItem === 'function') acknowledgeInboxItem(item.identity); _ntRemove(card); }
      if (act === 'copiar' && typeof formatTicketWA === 'function') {
        const ok = await _waWrite(formatTicketWA(item, isRal));
        _waFlash(e.target.closest('[data-act]'), ok);
      }
    });
  });
}

function _ntSummaryCard(rest) {
  const ral = rest.filter(i => i.typeKey === 'ral').length, rec = rest.length - ral;
  const parts = [ral ? `${ral} RAL${ral > 1 ? 's' : ''}` : '', rec ? `${rec} REC${rec > 1 ? 's' : ''}` : ''].filter(Boolean).join(' e ');
  const html = `
    <div class="nt-head">
      <span class="nt-badge nt-sum">+${rest.length} novos</span>
      <button class="nt-close" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="nt-desig">Mais ${_ntEsc(parts)} nas suas áreas. Veja todos em <b>Novas Entradas</b>.</div>
    <div class="nt-actions"><button type="button" class="nt-btn nt-primary" data-act="inbox">Abrir Novas Entradas</button></div>`;
  _ntShowCard(html, card => {
    card.querySelector('[data-act="inbox"]').addEventListener('click', () => {
      const sec = document.getElementById('inbox-section');
      if (sec) { if (!appState.inboxBodyVisible && typeof toggleInboxBody === 'function') toggleInboxBody(); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      _ntRemove(card);
    });
  });
}

/* Notificação do sistema (fora do navegador) — só com o SIR em segundo plano */
async function _ntSystem(items) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (typeof pushActive === 'function' && pushActive()) return;   /* o servidor já envia */
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  const first = items[0], isRal = first.typeKey === 'ral';
  const title = items.length === 1
    ? `${isRal ? 'RAL' : 'REC'} nova · ${first.cfOrigem}`
    : `${items.length} tickets novos nas suas áreas`;
  const body = items.length === 1
    ? `${first.ticket || ''} — ${first.designacao || ''}${first.extra && first.extra !== 'N/D' ? '\n' + first.extra : ''}`
    : items.slice(0, 4).map(i => `${i.typeKey === 'ral' ? 'RAL' : 'REC'} ${i.cfOrigem} · ${i.ticket}`).join('\n') + (items.length > 4 ? `\n+${items.length - 4}` : '');
  const opts = {
    body, tag: 'sir-novos', renotify: true, requireInteraction: true, vibrate: [200, 100, 200],
    icon: 'assets/icon-192.png', badge: 'assets/icon-192.png',
    data: items.length === 1 ? { cf: first.cfOrigem, tk: first.typeKey, ticket: first.ticket } : { inbox: true }
  };
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg && reg.showNotification) { await reg.showNotification(title, opts); return; }
  } catch (e) { /* cai para o método simples */ }
  try {
    const n = new Notification(title, opts);
    n.onclick = () => { window.focus(); if (opts.data.cf) notifyOpenTicket(opts.data.cf, opts.data.tk, opts.data.ticket); n.close(); };
  } catch (e) {}
}

function notifyNewTickets(items) {
  if (!items.length || !notifyEnabled()) return;
  /* Mais antigos primeiro, para o mais novo ficar no topo da pilha */
  const ordered = items.slice().sort((a, b) =>
    (typeof parseAbertura === 'function' ? parseAbertura(a.abertura) - parseAbertura(b.abertura) : 0));
  const max = _ntNarrow() ? NOTIFY_MAX_PHONE : NOTIFY_MAX_PC;
  const show = ordered.slice(-max), rest = ordered.slice(0, -max);
  if (rest.length) _ntSummaryCard(rest);
  show.forEach(_ntTicketCard);
  _ntSystem(ordered.slice().reverse());
}

/* ── Botão do sino ── */
function _ntUpdateButton() {
  const btn = document.getElementById('btn-notify');
  if (!btn) return;
  const on = notifyEnabled();
  const sys = ('Notification' in window) ? Notification.permission : 'unsupported';
  const icon = on ? 'bell-ring' : 'bell-off';
  if (btn.dataset.icon !== icon) {
    btn.dataset.icon = icon;
    btn.innerHTML = `<i data-lucide="${icon}"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [btn.firstChild] });
  }
  btn.classList.toggle('nt-off', !on);
  const t = on
    ? `Notificações ligadas (pop-up${typeof pushActive === 'function' && pushActive() ? ' + aviso com o app fechado' : sys === 'granted' ? ' + aviso do sistema' : ''}) — toque para desligar`
    : 'Notificações desligadas — toque para ligar';
  btn.title = t; btn.setAttribute('aria-label', t);
}

async function toggleNotifications() {
  const turningOn = !notifyEnabled();
  try { localStorage.setItem(LS_NOTIFY, turningOn ? 'on' : 'off'); } catch (e) {}
  if (turningOn && 'Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  _ntUpdateButton();
  if (typeof showActionToast === 'function') {
    const sys = ('Notification' in window) && Notification.permission === 'granted';
    showActionToast(turningOn ? `Notificações ligadas${sys ? '' : ' (só dentro do app)'}` : 'Notificações desligadas', 'success');
  }
}

/* Pedido de permissão do sistema: só depois de um toque (exigência do iPhone e navegadores) */
function _ntAskOnFirstTap() {
  if (!('Notification' in window) || Notification.permission !== 'default' || !notifyEnabled()) return;
  const ask = () => {
    document.removeEventListener('pointerdown', ask, true);
    if (Notification.permission === 'default')
      Notification.requestPermission().then(p => { _ntUpdateButton(); if (p === 'granted' && typeof syncPushSubscription === 'function') syncPushSubscription({ interactive: true, test: true }); }).catch(() => {});
  };
  document.addEventListener('pointerdown', ask, true);
}

/* ── Liga na detecção do Inbox ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof updateInboxWithNewEntries === 'function') {
    const _orig = updateInboxWithNewEntries;
    updateInboxWithNewEntries = function (areas, isStartup) {
      const before = new Set(appState.inboxItems.map(i => i.identity));
      const r = _orig.apply(this, arguments);
      const added = appState.inboxItems.filter(i => !before.has(i.identity));
      if (added.length) notifyNewTickets(added);
      return r;
    };
  }
  _ntUpdateButton();
  _ntAskOnFirstTap();

  /* Clique numa notificação do sistema (vinda do service worker) */
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', e => {
      const d = e.data || {};
      if (d.type !== 'sir-notification-click') return;
      if (d.cf) notifyOpenTicket(d.cf, d.tk, d.ticket);
      else document.getElementById('inbox-section')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
});
window.addEventListener('load', _ntUpdateButton);

/* ══════════════════════════════════════════════════════════════
   Push (com o SIR fechado/minimizado) — servidor em SIR_PUSH_URL
   ══════════════════════════════════════════════════════════════ */
const LS_PUSH_KEY = 'sir_push_key';
const LS_PUSH_OK  = 'sir_push_ok';

function _pushUrl() { return (typeof SIR_PUSH_URL === 'string' && SIR_PUSH_URL) ? SIR_PUSH_URL.replace(/\/+$/, '') : ''; }
function pushSupported() {
  return !!(_pushUrl() && location.protocol === 'https:' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
}
function pushActive() { try { return localStorage.getItem(LS_PUSH_OK) === '1'; } catch (e) { return false; } }
function _pushKey() { try { return localStorage.getItem(LS_PUSH_KEY) || ''; } catch (e) { return ''; } }
function _b64uToU8(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

async function _pushPost(path, payload) {
  const r = await fetch(_pushUrl() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

let _pushBusy = false;
/* Inscreve/atualiza este aparelho no servidor (áreas + ligado/desligado) */
async function syncPushSubscription(opts = {}) {
  if (!pushSupported() || _pushBusy) return false;
  if (Notification.permission !== 'granted') return false;
  const key = _pushKey();
  if (!key) { if (opts.interactive) _ntAskKeyCard(); return false; }
  _pushBusy = true;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      if (!notifyEnabled()) return false;
      const v = await (await fetch(_pushUrl() + '/vapid')).json();
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: _b64uToU8(v.publicKey) });
    }
    const areas = typeof getUserSavedAreas === 'function' ? getUserSavedAreas() : [];
    const device = (navigator.userAgentData && navigator.userAgentData.platform) || (/iPhone|iPad/.test(navigator.userAgent) ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'PC');
    const res = await _pushPost('/subscribe', { key, subscription: sub.toJSON(), areas, enabled: notifyEnabled(), device });
    if (res.status === 403) {
      try { localStorage.removeItem(LS_PUSH_KEY); localStorage.removeItem(LS_PUSH_OK); } catch (e) {}
      if (opts.interactive) _ntAskKeyCard('Chave incorreta. Digite novamente.');
      return false;
    }
    const ok = res.status === 200;
    try { localStorage.setItem(LS_PUSH_OK, ok && notifyEnabled() ? '1' : '0'); } catch (e) {}
    if (ok && opts.test) {
      await _pushPost('/test', { key, subscription: sub.toJSON(), delay: 10 });
      if (typeof showActionToast === 'function') showActionToast('Teste em 10 s — saia do SIR para ver a notificação chegar', 'success');
    }
    _ntUpdateButton();
    return ok;
  } catch (e) {
    console.warn('push:', e && e.message);
    return false;
  } finally { _pushBusy = false; }
}

/* Pede a chave dentro de um pop-up (aparelhos que entraram antes desta versão) */
function _ntAskKeyCard(msg) {
  if (document.querySelector('.nt-key')) return;
  const html = `
    <div class="nt-head">
      <span class="nt-badge nt-sum">Ativar avisos com o app fechado</span>
      <button class="nt-close" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="nt-desig">${msg ? '<b>' + _ntEsc(msg) + '</b><br>' : ''}Digite a chave de acesso do SIR uma vez neste aparelho.</div>
    <form class="nt-keyform">
      <input type="password" class="nt-keyinput" autocomplete="current-password" placeholder="Chave de acesso" required>
      <button type="submit" class="nt-btn nt-primary">Ativar</button>
    </form>`;
  const card = _ntShowCard(html, c => {
    c.classList.add('nt-key');
    c.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const v = c.querySelector('input').value.trim();
      if (!v) return;
      try { localStorage.setItem(LS_PUSH_KEY, v); } catch (err) {}
      _ntRemove(c);
      const ok = await syncPushSubscription({ interactive: true, test: true });
      if (ok && typeof showActionToast === 'function') showActionToast('Avisos com o app fechado ativados', 'success');
    });
  });
  _ntPause(card);   /* não some sozinho */
}

/* Liga o push junto com o sino e mantém as áreas atualizadas no servidor */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof toggleNotifications === 'function') {
    const _tOrig = toggleNotifications;
    toggleNotifications = async function () {
      await _tOrig.apply(this, arguments);
      if (pushSupported()) await syncPushSubscription({ interactive: true, test: notifyEnabled() });
    };
  }
  if (typeof saveSettings === 'function') {
    const _sOrig = saveSettings;
    saveSettings = function (cb) { return _sOrig(function () { if (cb) cb(); syncPushSubscription(); }); };
  }
});
window.addEventListener('load', () => {
  if (!pushSupported() || !notifyEnabled()) return;
  if (Notification.permission === 'granted') syncPushSubscription({ interactive: !_pushKey() });
});
