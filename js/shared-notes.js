/* ══════════════════════════════════════════════════════════════
   Notas da equipe (compartilhadas)
   - Várias notas por ticket, em ordem de data e hora
   - Cada nota: adicionar, editar, excluir (com autor e horário)
   - Status OBS e classificação (bolinha) também compartilhados
   - Tudo fica no servidor (SIR_PUSH_URL) para todos com a chave;
     sem servidor/chave, funciona só neste aparelho
   - Atualiza a cada 1 min, ao abrir uma lista e ao voltar ao app
   ══════════════════════════════════════════════════════════════ */

const LS_USER_NAME     = 'sir_user_name';
const LS_NOTES_MIGR    = 'sir_notes_migrated2';
const LS_NOTES_SRV_IDS = 'sir_notes_server_ids';
const SN_POLL_MS       = 60000;

let _snServerIds = new Set();
try { _snServerIds = new Set(JSON.parse(localStorage.getItem(LS_NOTES_SRV_IDS) || '[]')); } catch (e) {}
let _snLastPull = 0, _snPulling = false, _snKeyAsked = false;

function _snUrl()  { return typeof _pushUrl === 'function' ? _pushUrl() : ''; }
function _snKey()  { return typeof _pushKey === 'function' ? _pushKey() : ''; }
function _snUser() { try { return localStorage.getItem(LS_USER_NAME) || ''; } catch (e) { return ''; } }
function sharedNotesReady() { return !!(_snUrl() && location.protocol === 'https:'); }
function _snNewId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

async function _snPost(path, payload) {
  const r = await fetch(_snUrl() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  return { status: r.status, body: j };
}
function _snAskKey() {
  if (_snKeyAsked || typeof _ntAskKeyCard !== 'function') return;
  _snKeyAsked = true;
  _ntAskKeyCard();
}

/* ── Notas de um ticket (sempre em lista, ordem cronológica) ── */
function getTicketNotes(identity) {
  const st = appState.ticketStates[identity] || {};
  let list = Array.isArray(st.notes) ? st.notes.slice() : [];
  if (!list.length && st.obs) list = [{ i: 'legacy', t: st.obs, by: st.noteBy || '', at: st.noteAt || st.ts || Date.now() }];
  return list.sort((a, b) => (a.at || 0) - (b.at || 0));
}
function _snSetLocal(identity, patch) {
  const cur = appState.ticketStates[identity] || {};
  const next = { ...cur, ...patch, ts: Date.now() };
  if ('notes' in patch) next.obs = next.notes.length ? next.notes[next.notes.length - 1].t : '';
  const empty = !(next.notes && next.notes.length) && !next.obs
             && (!next.obsStatus || next.obsStatus === 'none')
             && (!next.eventColor || next.eventColor === 'none');
  if (empty) delete appState.ticketStates[identity]; else appState.ticketStates[identity] = next;
  _snSaveLocal();
}
function _snSaveLocal() {
  try { localStorage.setItem(STORAGE_TICKET, JSON.stringify(appState.ticketStates)); } catch (e) {}
  try { localStorage.setItem(LS_NOTES_SRV_IDS, JSON.stringify([..._snServerIds])); } catch (e) {}
}
function _snApplyServer(id, n) {
  const cur = appState.ticketStates[id] || {};
  const list = Array.isArray(n.list) ? n.list : [];
  appState.ticketStates[id] = {
    ...cur, notes: list, obs: list.length ? list[list.length - 1].t : '',
    obsStatus: n.st || 'none', eventColor: n.tag || 'none', ts: Date.now()
  };
  _snServerIds.add(id);
}

function _snWhen(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}
function noteMetaText(n) {
  return `${n.by ? n.by + ' · ' : ''}${_snWhen(n.at)}${n.et ? ' (editada)' : ''}`;
}

/* ── Desenho da célula de notas ── */
function renderNotesCell(row) {
  if (!row) return;
  const cell = row.querySelector('td.obs-cell');
  if (!cell || cell.querySelector('.obs-input')) return;   /* não mexe enquanto alguém digita */
  const list = getTicketNotes(row.dataset.identity);
  cell.classList.toggle('has-obs', list.length > 0);
  cell.innerHTML =
    (list.length ? `<div class="notes-list">${list.map(n => `
      <div class="note-item" data-nid="${escapeHtml(n.i)}">
        <div class="note-text">${escapeHtml(n.t)}</div>
        <div class="note-foot">
          <span class="note-meta">${escapeHtml(noteMetaText(n))}</span>
          <button type="button" class="note-btn" data-act="edit" title="Editar nota" aria-label="Editar nota">✎</button>
          <button type="button" class="note-btn note-del" data-act="del" title="Excluir nota" aria-label="Excluir nota">✕</button>
        </div>
      </div>`).join('')}</div>` : '') +
    `<button type="button" class="btn-add-obs${list.length ? ' btn-add-more' : ''}" onclick="startAddObs(this)" title="Adicionar nota">${list.length ? '+ Nota' : '+'}</button>`;
}

function _snInputHTML(value, withName) {
  return `<div class="obs-input-wrap${withName ? ' with-name' : ''}">
    <div class="obs-input-row">
      <input type="text" class="obs-input" maxlength="300" placeholder="Digite a nota..." autocomplete="off" value="${escapeHtml(value || '')}">
      <button class="btn-obs-confirm" title="Salvar">✓</button>
      <button class="btn-obs-cancel" title="Cancelar">×</button>
    </div>
    ${withName ? `<label class="note-who" title="Responsável pela nota">
      <span>Responsável</span>
      <input type="text" class="note-who-input" maxlength="30" placeholder="Nome" autocomplete="name" value="${escapeHtml(_snUser())}">
    </label>` : ''}
  </div>`;
}
/* onSave(texto, responsável) */
function _snOpenInput(container, value, onSave, onCancel, withName) {
  container.insertAdjacentHTML('beforeend', _snInputHTML(value, withName));
  const wrap = container.querySelector('.obs-input-wrap:last-child');
  const inp = wrap.querySelector('.obs-input');
  const who = wrap.querySelector('.note-who-input');
  const save = () => {
    const v = inp.value.trim();
    if (!v) return onCancel();
    const name = who ? who.value.trim().slice(0, 30) : '';
    if (who && name) { try { localStorage.setItem(LS_USER_NAME, name); } catch (e) {} }   /* vira o padrão da próxima */
    onSave(v, name);
  };
  wrap.querySelector('.btn-obs-confirm').addEventListener('click', e => { e.stopPropagation(); save(); });
  wrap.querySelector('.btn-obs-cancel').addEventListener('click', e => { e.stopPropagation(); onCancel(); });
  [inp, who].filter(Boolean).forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onCancel(); }));
  inp.focus();
  if (value) inp.setSelectionRange(value.length, value.length);
}

/* ── Operações ── */
async function notesOp(identity, op, args = {}) {
  /* 1) aplica na hora, neste aparelho */
  const list = getTicketNotes(identity).filter(n => n.i !== 'legacy' || op !== 'del' || args.nid !== 'legacy');
  const user = (op === 'add' && args.by !== undefined) ? args.by : _snUser();
  let nid = args.nid;
  if (op === 'add') { nid = _snNewId(); list.push({ i: nid, t: args.text, by: user, at: Date.now() }); }
  if (op === 'edit') { const n = list.find(x => x.i === nid); if (n) { n.t = args.text; n.et = Date.now(); } }
  if (op === 'del') { const k = list.findIndex(x => x.i === nid); if (k > -1) list.splice(k, 1); }
  _snSetLocal(identity, { notes: list });
  _snRefreshOpenModal();

  /* 2) envia para a equipe */
  if (!sharedNotesReady()) return;
  const key = _snKey();
  if (!key) { _snAskKey(); return; }
  try {
    const legacy = nid === 'legacy';
    const r = legacy
      ? await _snPost('/note', { key, id: identity, op: op === 'del' ? 'meta' : 'add', text: args.text, by: user })
      : await _snPost('/note', { key, id: identity, op, nid, text: args.text, by: user });
    if (r.status === 403) { try { localStorage.removeItem('sir_push_key'); } catch (e) {} _snKeyAsked = false; _snAskKey(); return; }
    if (r.status === 200) {
      if (r.body.note) _snApplyServer(identity, r.body.note);
      else { _snServerIds.delete(identity); _snSetLocal(identity, { notes: [], obsStatus: 'none', eventColor: 'none' }); }
      _snSaveLocal();
      _snRefreshOpenModal();
    }
  } catch (e) {
    if (typeof showActionToast === 'function') showActionToast('Sem conexão: a nota ficou só neste aparelho por enquanto', 'error');
  }
}

async function _snPushMeta(identity) {
  if (!sharedNotesReady() || !identity) return;
  const key = _snKey();
  if (!key) { _snAskKey(); return; }
  const st = appState.ticketStates[identity] || {};
  const tag = typeof getTicketTag === 'function' && getTicketTag(st.eventColor) ? st.eventColor : 'none';
  try {
    const r = await _snPost('/note', { key, id: identity, op: 'meta', st: st.obsStatus || 'none', tag, by: _snUser() });
    if (r.status === 200) {
      if (r.body.note) _snApplyServer(identity, r.body.note); else _snServerIds.delete(identity);
      _snSaveLocal();
      _snRefreshOpenModal();
    }
  } catch (e) {}
}

/* ── Baixa tudo da equipe ── */
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

    /* 1ª vez nesta versão: envia o que existia só neste aparelho */
    let migrated = false; try { migrated = localStorage.getItem(LS_NOTES_MIGR) === '1'; } catch (e) {}
    if (!migrated) {
      for (const [id, st] of Object.entries(appState.ticketStates)) {
        if (notes[id] || _snServerIds.has(id)) continue;
        for (const n of getTicketNotes(id)) {
          const res = await _snPost('/note', { key, id, op: 'add', text: n.t, by: n.by || _snUser() });
          if (res.body && res.body.note) notes[id] = res.body.note;
        }
        const tag = typeof getTicketTag === 'function' && getTicketTag(st.eventColor) ? st.eventColor : 'none';
        if ((st.obsStatus && st.obsStatus !== 'none') || tag !== 'none') {
          const res = await _snPost('/note', { key, id, op: 'meta', st: st.obsStatus || 'none', tag, by: _snUser() });
          if (res.body && res.body.note) notes[id] = res.body.note;
        }
      }
      try { localStorage.setItem(LS_NOTES_MIGR, '1'); } catch (e) {}
    }

    for (const [id, n] of Object.entries(notes)) _snApplyServer(id, n);
    /* Itens apagados por alguém da equipe */
    for (const id of [..._snServerIds]) {
      if (notes[id]) continue;
      delete appState.ticketStates[id];
      _snServerIds.delete(id);
    }
    _snLastPull = Date.now();
    _snSaveLocal();
    _snRefreshOpenModal();
  } catch (e) {
    console.warn('notas:', e && e.message);
  } finally { _snPulling = false; }
}

/* ── Nome de quem escreve (uma vez por aparelho) ── */
function _snAskName() {
  if (_snUser() || document.querySelector('.nt-name') || typeof _ntShowCard !== 'function') return;
  const html = `
    <div class="nt-head">
      <span class="nt-badge nt-sum">Notas da equipe</span>
      <button class="nt-close" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="nt-desig">Suas notas e classificações aparecem para todos que usam o SIR. Como você quer aparecer nelas?</div>
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
    });
  });
  if (typeof _ntPause === 'function') _ntPause(card);
}

/* ── Atualiza a lista aberta ── */
function _snRefreshOpenModal() {
  const ov = document.getElementById('modal-overlay');
  if (!ov || !ov.classList.contains('active')) return;
  document.querySelectorAll('#modal-tbody tr.ticket-row').forEach(row => {
    const st = appState.ticketStates[row.dataset.identity] || {};
    renderNotesCell(row);
    const tagKey = st.eventColor || 'none';
    if ((row.dataset.eventColor || 'none') !== tagKey) row.dataset.eventColor = tagKey;
    const status = st.obsStatus || 'none';
    if ((row.dataset.obsStatus || 'none') !== status) {
      row.dataset.obsStatus = status;
      row.classList.toggle('pinned-bottom', status !== 'none');
      const sc = row.querySelector('td.obs-status-col');
      if (sc) sc.innerHTML = buildObsStatusHTML(status);
    }
  });
  if (typeof renderAllTicketTags === 'function') renderAllTicketTags();
}

/* ── Ligações com o código existente ── */
document.addEventListener('DOMContentLoaded', () => {
  /* Botão "+" (nova nota) */
  startAddObs = function (btn) {
    const row = btn.closest('tr'), cell = btn.closest('td');
    btn.remove();
    _snOpenInput(cell, '',
      (text, by) => { cell.querySelector('.obs-input-wrap')?.remove(); notesOp(row.dataset.identity, 'add', { text, by }); },
      () => { cell.querySelector('.obs-input-wrap')?.remove(); renderNotesCell(row); },
      true);
  };
  /* Editar / excluir (cliques dentro da lista de notas) */
  document.addEventListener('click', e => {
    const b = e.target.closest('#modal-tbody .note-btn');
    if (!b) return;
    e.stopPropagation();
    const row = b.closest('tr'), item = b.closest('.note-item');
    const nid = item.dataset.nid, identity = row.dataset.identity;
    if (b.dataset.act === 'edit') {
      const n = getTicketNotes(identity).find(x => x.i === nid);
      if (!n) return;
      item.innerHTML = '';
      _snOpenInput(item, n.t,
        text => { item.querySelector('.obs-input-wrap')?.remove(); notesOp(identity, 'edit', { nid, text }); },
        () => { item.querySelector('.obs-input-wrap')?.remove(); renderNotesCell(row); });
    }
    if (b.dataset.act === 'del') {
      if (!b.classList.contains('confirm')) {          /* 1º toque: pede confirmação */
        b.classList.add('confirm'); b.textContent = 'Excluir?';
        setTimeout(() => { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = '✕'; } }, 3000);
        return;
      }
      notesOp(identity, 'del', { nid });
    }
  }, true);   /* captura: a janela da lista bloqueia a propagação dos cliques */

  if (typeof persistTicketState === 'function') {
    const _orig = persistTicketState;
    persistTicketState = function (identity, updates) {
      const r = _orig.apply(this, arguments);
      if (updates && ('obsStatus' in updates || 'eventColor' in updates)) {
        _snPushMeta(identity);
        if (!_snUser() && ((updates.obsStatus && updates.obsStatus !== 'none') || (updates.eventColor && updates.eventColor !== 'none'))) _snAskName();
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
