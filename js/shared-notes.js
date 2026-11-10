/* ══════════════════════════════════════════════════════════════
   Notas compartilhadas
   - Nota (texto) e status OBS de cada ticket ficam no servidor e
     aparecem para todos que acessam o SIR com a chave.
   - A cor (bolinha) continua pessoal, só no seu aparelho.
   - Atualiza a cada 1 min, ao abrir uma lista e ao voltar ao app.
   - Mostra quem escreveu e quando (nome definido uma vez por aparelho).
   ══════════════════════════════════════════════════════════════ */

const LS_USER_NAME     = 'sir_user_name';
const LS_NOTES_MIGR    = 'sir_notes_migrated';
const LS_NOTES_SRV_IDS = 'sir_notes_server_ids';
const SN_POLL_MS       = 60000;

let _snServerIds = new Set();
try { _snServerIds = new Set(JSON.parse(localStorage.getItem(LS_NOTES_SRV_IDS) || '[]')); } catch (e) {}
let _snLastPull = 0, _snPulling = false, _snKeyAsked = false;

function _snUrl() { return typeof _pushUrl === 'function' ? _pushUrl() : ''; }
function _snKey() { return typeof _pushKey === 'function' ? _pushKey() : ''; }
function _snUser() { try { return localStorage.getItem(LS_USER_NAME) || ''; } catch (e) { return ''; } }
function sharedNotesReady() { return !!(_snUrl() && location.protocol === 'https:'); }

async function _snPost(path, payload) {
  const r = await fetch(_snUrl() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}

function _snSaveLocal() {
  try { localStorage.setItem(STORAGE_TICKET, JSON.stringify(appState.ticketStates)); } catch (e) {}
  try { localStorage.setItem(LS_NOTES_SRV_IDS, JSON.stringify([..._snServerIds])); } catch (e) {}
}

function _snAskKey() {
  if (_snKeyAsked || typeof _ntAskKeyCard !== 'function') return;
  _snKeyAsked = true;
  _ntAskKeyCard();
}

/* ── Baixa as notas da equipe e aplica ── */
async function pullSharedNotes(force) {
  if (!sharedNotesReady() || _snPulling) return;
  if (!force && Date.now() - _snLastPull < 3000) return;
  const key = _snKey();
  if (!key) { _snAskKey(); return; }
  _snPulling = true;
  try {
    const r = await _snPost('/notes', { key });
    if (r.status === 403) { try { localStorage.removeItem('sir_push_key'); } catch (e) {} _snKeyAsked = false; _snAskKey(); return; }
    if (r.status !== 200 || !r.body.notes) return;
    const notes = r.body.notes;

    /* 1ª vez neste aparelho: envia as notas que já existiam só aqui */
    let migrated = false; try { migrated = localStorage.getItem(LS_NOTES_MIGR) === '1'; } catch (e) {}
    if (!migrated) {
      for (const [id, st] of Object.entries(appState.ticketStates)) {
        const hasObs = st.obs || (st.obsStatus && st.obsStatus !== 'none');
        if (hasObs && !notes[id]) {
          const res = await _snPost('/note', { key, id, obs: st.obs || '', st: st.obsStatus || 'none', by: _snUser() });
          if (res.body && res.body.note) notes[id] = res.body.note;
        }
      }
      try { localStorage.setItem(LS_NOTES_MIGR, '1'); } catch (e) {}
    }

    /* Aplica: o servidor manda em nota e status; a cor continua sua */
    for (const [id, n] of Object.entries(notes)) {
      const cur = appState.ticketStates[id] || {};
      appState.ticketStates[id] = { ...cur, obs: n.obs || '', obsStatus: n.st || 'none', noteBy: n.by || '', noteAt: n.at || 0, ts: Date.now() };
    }
    /* Notas apagadas por alguém da equipe */
    for (const id of _snServerIds) {
      if (notes[id]) continue;
      const cur = appState.ticketStates[id];
      if (!cur) continue;
      const next = { ...cur, obs: '', obsStatus: 'none', noteBy: '', noteAt: 0 };
      if (!next.eventColor || next.eventColor === 'none') delete appState.ticketStates[id];
      else appState.ticketStates[id] = next;
    }
    _snServerIds = new Set(Object.keys(notes));
    _snLastPull = Date.now();
    _snSaveLocal();
    _snRefreshOpenModal();
  } catch (e) {
    console.warn('notas:', e && e.message);
  } finally { _snPulling = false; }
}

/* ── Envia a nota/status ao salvar ── */
async function _snPush(identity) {
  if (!sharedNotesReady() || !identity) return;
  const key = _snKey();
  if (!key) { _snAskKey(); return; }
  const st = appState.ticketStates[identity] || {};
  try {
    const r = await _snPost('/note', { key, id: identity, obs: st.obs || '', st: st.obsStatus || 'none', by: _snUser() });
    if (r.status === 200) {
      if (r.body.note) {
        _snServerIds.add(identity);
        if (appState.ticketStates[identity]) Object.assign(appState.ticketStates[identity], { noteBy: r.body.note.by, noteAt: r.body.note.at });
      } else _snServerIds.delete(identity);
      _snSaveLocal();
      _snRefreshOpenModal();
    }
  } catch (e) {
    if (typeof showActionToast === 'function') showActionToast('Sem conexão: a nota ficou só neste aparelho por enquanto', 'error');
  }
}

/* ── Nome de quem escreve (uma vez por aparelho) ── */
function _snAskName(identity) {
  if (_snUser() || document.querySelector('.nt-name') || typeof _ntShowCard !== 'function') return;
  const html = `
    <div class="nt-head">
      <span class="nt-badge nt-sum">Notas da equipe</span>
      <button class="nt-close" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="nt-desig">Suas notas agora aparecem para todos que usam o SIR. Como você quer aparecer nelas?</div>
    <form class="nt-keyform">
      <input type="text" class="nt-keyinput" maxlength="30" placeholder="Seu nome" autocomplete="name" required>
      <button type="submit" class="nt-btn nt-primary">Salvar</button>
    </form>`;
  const card = _ntShowCard(html, c => {
    c.classList.add('nt-key', 'nt-name');
    c.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const v = c.querySelector('input').value.trim().slice(0, 30);
      if (!v) return;
      try { localStorage.setItem(LS_USER_NAME, v); } catch (err) {}
      _ntRemove(c);
      if (identity) _snPush(identity);   /* reenvia a nota já com o nome */
    });
  });
  if (typeof _ntPause === 'function') _ntPause(card);
}

/* ── Atualiza a lista aberta com as notas da equipe ── */
function _snMetaText(st) {
  if (!st || !st.noteAt) return '';
  const d = new Date(st.noteAt);
  const hoje = new Date().toDateString() === d.toDateString();
  const quando = hoje
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${st.noteBy ? st.noteBy + ' · ' : ''}${quando}`;
}

function _snRefreshOpenModal() {
  const ov = document.getElementById('modal-overlay');
  if (!ov || !ov.classList.contains('active')) return;
  document.querySelectorAll('#modal-tbody tr.ticket-row').forEach(row => {
    const id = row.dataset.identity;
    const st = appState.ticketStates[id] || {};
    const obsCell = row.querySelector('td.obs-cell');
    if (obsCell && !obsCell.querySelector('.obs-input')) {
      obsCell.innerHTML = buildObsHTML(st.obs || '');
      obsCell.classList.toggle('has-obs', !!st.obs);
      const meta = _snMetaText(st);
      const content = obsCell.querySelector('.obs-content');
      if (content && meta) {
        const m = document.createElement('span');
        m.className = 'obs-meta'; m.textContent = meta;
        content.appendChild(m);
        const t = content.querySelector('.obs-text');
        if (t) t.title = `${st.obs}\n— ${meta}`;
      }
    }
    const status = st.obsStatus || 'none';
    if ((row.dataset.obsStatus || 'none') !== status) {
      row.dataset.obsStatus = status;
      row.classList.toggle('pinned-bottom', status !== 'none');
      const sc = row.querySelector('td.obs-status-col');
      if (sc) sc.innerHTML = buildObsStatusHTML(status);
    }
  });
}

/* ── Ligações com o código existente ── */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof persistTicketState === 'function') {
    const _orig = persistTicketState;
    persistTicketState = function (identity, updates) {
      const r = _orig.apply(this, arguments);
      if (updates && ('obs' in updates || 'obsStatus' in updates)) {
        _snPush(identity);
        if (!_snUser() && (updates.obs || (updates.obsStatus && updates.obsStatus !== 'none'))) _snAskName(identity);
      }
      return r;
    };
  }
  if (typeof applyTicketStatesToTbody === 'function') {
    const _apply = applyTicketStatesToTbody;
    applyTicketStatesToTbody = function () { const r = _apply.apply(this, arguments); _snRefreshOpenModal(); return r; };
  }
  if (typeof openModal === 'function') {
    const _open = openModal;
    openModal = function () { const r = _open.apply(this, arguments); pullSharedNotes(); return r; };
  }
  document.addEventListener('sir-key-saved', () => pullSharedNotes(true));
});

window.addEventListener('load', () => {
  if (!sharedNotesReady()) return;
  setTimeout(() => pullSharedNotes(true), 800);
  setInterval(() => { if (document.visibilityState === 'visible') pullSharedNotes(); }, SN_POLL_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pullSharedNotes(); });
});
