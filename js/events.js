/* ══════════════════════════════════════════════════════════════
   ASSOCIAR tickets (tela de CF)
   - CRIAR EVENTO: dá um nome e escolhe as RAL/REC envolvidas
   - VIDE RAL/REC: escolhe 1 ticket principal e os demais vinculados
   Os tickets associados ficam juntos num subgrupo no topo da lista;
   os outros continuam fora dele. O evento aparece em "Filtrar status"
   e, filtrado, "Copiar selecionados" copia só os tickets dele.
   O vínculo é compartilhado com a equipe (mesmo servidor das notas).
   ══════════════════════════════════════════════════════════════ */

const EV_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#facc15', '#60a5fa', '#f87171'];
function evColor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return EV_COLORS[h % EV_COLORS.length]; }
function evOf(identity) { const e = (appState.ticketStates[identity] || {}).ev; return e && e.id ? e : null; }
function _evTk() { return appState.currentModalType || 'ral'; }
function _evTkLabel() { return _evTk().toUpperCase(); }
function _evNewId() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function _evRows() { return [...document.querySelectorAll('#modal-tbody tr.ticket-row')]; }
function _evToast(t, ok = true) { if (typeof showActionToast === 'function') showActionToast(t, ok ? 'success' : 'error'); }

/* Eventos presentes na lista aberta (na ordem em que aparecem) */
function evInList() {
  const map = new Map();
  for (const r of _evRows()) {
    const e = evOf(r.dataset.identity); if (!e) continue;
    if (!map.has(e.id)) map.set(e.id, { ev: e, ids: [] });
    map.get(e.id).ids.push(r.dataset.identity);
  }
  return map;
}

/* ── Gravar (servidor da equipe; sem servidor, só neste aparelho) ── */
function _evSetLocal(ids, clear, ev) {
  for (const id of clear) { const st = appState.ticketStates[id]; if (st) { delete st.ev; if (typeof _snSetLocal === 'function') _snSetLocal(id, {}); } }
  for (const id of ids) {
    const cur = appState.ticketStates[id] || {};
    appState.ticketStates[id] = { ...cur, ev: { ...ev }, ts: Date.now() };
  }
  if (typeof _snSaveLocal === 'function') _snSaveLocal();
  else try { localStorage.setItem(STORAGE_TICKET, JSON.stringify(appState.ticketStates)); } catch (e) {}
}
async function evSave(ids, clear, ev) {
  _evSetLocal(ids, clear, ev);        /* mostra na hora */
  layoutEventGroups(); if (typeof applyTagFilter === 'function') applyTagFilter();
  const key = typeof _snKey === 'function' ? _snKey() : '';
  if (!(typeof sharedNotesReady === 'function' && sharedNotesReady()) || !key) return true;
  try {
    const r = await _snPost('/note', { key, op: 'evset', ev, ids, clear, by: typeof _snUser === 'function' ? _snUser() : '' });
    if (r.status !== 200 || !r.body.ok) throw new Error(r.status);
    for (const [id, n] of Object.entries(r.body.notes || {})) {
      if (n) _snApplyServer(id, n);
      else { const st = appState.ticketStates[id]; if (st) delete st.ev; _snServerIds.delete(id); }
    }
    _snSaveLocal();
    layoutEventGroups(); if (typeof applyTagFilter === 'function') applyTagFilter();
    return true;
  } catch (e) {
    _evToast('Não consegui salvar no servidor — ficou só neste aparelho', false);
    return false;
  }
}

/* ══════════ Subgrupos na lista ══════════ */
let _evLayoutBusy = false;
function layoutEventGroups() {
  const tb = document.getElementById('modal-tbody');
  if (!tb || _evLayoutBusy) return;
  _evLayoutBusy = true;
  try {
    tb.querySelectorAll('tr.ev-row').forEach(r => r.remove());
    const rows = _evRows();
    rows.forEach(r => {
      r.classList.remove('ev-member', 'ev-principal', 'ev-last');
      r.style.removeProperty('--evc');
      r.querySelector('.ev-badge')?.remove();
      delete r.dataset.ev;
    });
    const groups = evInList();
    if (!groups.size) return;
    const frag = document.createDocumentFragment();
    for (const [id, g] of groups) {
      const e = g.ev, col = evColor(id);
      const members = rows.filter(r => g.ids.includes(r.dataset.identity));
      members.sort((a, b) => (b.dataset.identity === e.pi) - (a.dataset.identity === e.pi));   /* principal primeiro */
      const head = document.createElement('tr');
      head.className = 'ev-row ev-head'; head.dataset.ev = id; head.style.setProperty('--evc', col);
      head.innerHTML = `<td colspan="10"><div class="ev-head-in">
          <span class="ev-kind">${e.k === 'vide' ? 'VIDE' : 'EVENTO'}</span>
          <b class="ev-name" title="${escapeHtml(e.n)}">${escapeHtml(e.n)}</b>
          <span class="ev-count">${members.length} ticket${members.length === 1 ? '' : 's'}</span>
          <span class="ev-sp"></span>
          <button type="button" class="ev-btn" data-evact="copy" title="Copiar só os tickets deste ${e.k === 'vide' ? 'vínculo' : 'evento'}">Copiar</button>
          <button type="button" class="ev-btn" data-evact="edit" title="Incluir ou tirar tickets">Editar</button>
          <button type="button" class="ev-btn ev-btn-del" data-evact="del" title="Desfazer a associação (os tickets voltam para a lista)">Desfazer</button>
        </div></td>`;
      frag.appendChild(head);
      members.forEach((r, i) => {
        r.classList.add('ev-member'); r.dataset.ev = id; r.style.setProperty('--evc', col);
        if (i === members.length - 1) r.classList.add('ev-last');
        const isP = e.k === 'vide' && r.dataset.identity === e.pi;
        if (isP) r.classList.add('ev-principal');
        /* Selo só no principal (o cabeçalho do subgrupo já diz o evento) — fora da célula do número para não cortá-lo */
        const host = r.querySelector('td:nth-child(4)');
        if (isP && host) host.insertAdjacentHTML('afterbegin', `<span class="ev-badge p">★ PRINCIPAL</span>`);
        frag.appendChild(r);
      });
      const foot = document.createElement('tr');
      foot.className = 'ev-row ev-foot'; foot.dataset.ev = id; foot.style.setProperty('--evc', col);
      foot.innerHTML = '<td colspan="10"></td>';
      frag.appendChild(foot);
    }
    const rest = rows.filter(r => !r.classList.contains('ev-member'));
    if (rest.length) {
      const div = document.createElement('tr');
      div.className = 'ev-row ev-rest';
      div.innerHTML = `<td colspan="10">Demais tickets — fora dos eventos</td>`;
      frag.appendChild(div);
    }
    tb.insertBefore(frag, tb.firstChild);
    _evSyncVisibility();
  } finally { _evLayoutBusy = false; }
}
/* Esconde o cabeçalho do subgrupo quando o filtro esconde todos os tickets dele */
function _evSyncVisibility() {
  const hidden = r => r.classList.contains('tag-hidden') || r.style.display === 'none';
  document.querySelectorAll('#modal-tbody tr.ev-head, #modal-tbody tr.ev-foot').forEach(h => {
    const vis = _evRows().filter(r => r.dataset.ev === h.dataset.ev && !hidden(r));
    h.hidden = !vis.length;
    if (h.classList.contains('ev-head')) { const c = h.querySelector('.ev-count'); if (c) c.textContent = `${vis.length} ticket${vis.length === 1 ? '' : 's'}`; }
  });
  const rest = document.querySelector('#modal-tbody tr.ev-rest');
  if (rest) rest.hidden = !_evRows().some(r => !r.dataset.ev && !hidden(r));
}

/* ══════════ Copiar ══════════ */
function _evItemsOf(evId) {
  const tk = _evTk(), list = (modalData[tk] && modalData[tk][appState.currentModalKey]) || [];
  const items = list.filter(i => { const e = evOf(makeIdentity(tk, i)); return e && e.id === evId; });
  const e = items.length ? evOf(makeIdentity(tk, items[0])) : null;
  items.sort((a, b) => ((makeIdentity(tk, b) === e?.pi) - (makeIdentity(tk, a) === e?.pi)) || (parseAbertura(b.abertura) - parseAbertura(a.abertura)));
  return { items, ev: e };
}
function evHeadText(e, n) {
  const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
  return e.k === 'vide'
    ? `🔗 *VIDE ${e.pt}*\n📊 ${n} ticket${n === 1 ? '' : 's'} vinculado${n === 1 ? '' : 's'} · 📅 ${now}`
    : `🚨 *EVENTO: ${e.n}*\n📊 ${n} ticket${n === 1 ? '' : 's'} · 📅 ${now}`;
}
async function copyEvent(evId, btn) {
  const { items, ev } = _evItemsOf(evId);
  if (!items.length) return _evToast('Nenhum ticket neste evento', false);
  const isRal = _evTk() === 'ral';
  const text = evHeadText(ev, items.length) + '\n\n' + items.map(i => formatTicketWA(i, isRal)).join('\n\n');
  const ok = await _waWrite(text);
  if (btn && typeof _waFlash === 'function') _waFlash(btn, ok);
  _evToast(ok ? `${items.length} copiado${items.length > 1 ? 's' : ''} — cole no WhatsApp` : 'Não foi possível copiar', ok);
}

/* ══════════ Botão ASSOCIAR + menu ══════════ */
function _evButton() {
  if (document.getElementById('btn-modal-assoc')) return;
  const ref = document.getElementById('btn-modal-copy-sel');
  if (!ref) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'btn-modal-assoc'; b.className = 'modal-csv-btn btn-assoc';
  b.textContent = 'Associar'; b.title = 'Agrupar tickets: criar evento ou VIDE';
  b.addEventListener('click', e => { e.stopPropagation(); toggleAssocMenu(b); });
  ref.insertAdjacentElement('afterend', b);
}
function removeAssocMenu() { const m = document.getElementById('assoc-menu'); if (m) { m._cleanup?.(); m.remove(); } }
function toggleAssocMenu(btn) {
  if (document.getElementById('assoc-menu')) return removeAssocMenu();
  if (typeof removeTagFilterMenu === 'function') removeTagFilterMenu();
  const m = document.createElement('div');
  m.id = 'assoc-menu'; m.className = 'tag-picker assoc-menu';
  m.innerHTML = `<div class="tag-picker-head">Associar tickets</div>
    <button type="button" class="assoc-opt" data-k="evento"><b>Criar evento</b><span>Dar um nome e escolher os tickets envolvidos</span></button>
    <button type="button" class="assoc-opt" data-k="vide"><b>VIDE ${_evTkLabel()}</b><span>Escolher 1 ticket principal e vincular os demais</span></button>`;
  document.body.appendChild(m);
  if (window.matchMedia && matchMedia('(max-width: 640px)').matches) m.classList.add('tag-sheet');
  else {
    const r = btn.getBoundingClientRect(), mw = 270;
    m.style.left = Math.max(8, Math.min(r.right - mw, innerWidth - mw - 8)) + 'px';
    m.style.top = (r.bottom + 6) + 'px';
  }
  m.addEventListener('click', e => {
    e.stopPropagation();
    const o = e.target.closest('.assoc-opt'); if (!o) return;
    removeAssocMenu();
    o.dataset.k === 'evento' ? startEventFlow() : startVideFlow();
  });
  const onClose = ev => { if (!m.contains(ev.target) && ev.target !== btn) removeAssocMenu(); };
  const onKey = ev => { if (ev.key === 'Escape') { ev.stopImmediatePropagation(); ev.preventDefault(); removeAssocMenu(); } };
  setTimeout(() => document.addEventListener('click', onClose, true), 0);
  window.addEventListener('keydown', onKey, true);
  m._cleanup = () => { document.removeEventListener('click', onClose, true); window.removeEventListener('keydown', onKey, true); };
}

/* ══════════ Modo de seleção ══════════ */
let evSel = null;   /* { k, step:'name'|'principal'|'pick', id, n, pi, pt, chosen:Set, before:Set } */

function _evBar() {
  let bar = document.getElementById('ev-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'ev-bar'; bar.className = 'ev-bar';
    document.getElementById('modal-filter-bar')?.insertAdjacentElement('afterend', bar);
    bar.addEventListener('click', e => e.stopPropagation());
  }
  return bar;
}
function _evRenderBar() {
  const bar = _evBar();
  if (!evSel) { bar.remove(); return; }
  const n = evSel.chosen.size, L = _evTkLabel();
  if (evSel.step === 'name') {
    bar.innerHTML = `<div class="ev-bar-t"><b>Criar evento</b> · passo 1 de 2: nome do evento</div>
      <div class="ev-bar-row"><input type="text" id="ev-name-in" class="ev-name-in" maxlength="60" placeholder="Ex.: Rompimento BR-101 km 23" autocomplete="off" value="${escapeHtml(evSel.n || '')}">
      <button type="button" class="ev-bar-btn pri" data-b="next">Avançar</button><button type="button" class="ev-bar-btn" data-b="cancel">Cancelar</button></div>`;
    const inp = bar.querySelector('#ev-name-in');
    setTimeout(() => inp.focus(), 30);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _evNext(); } if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEvSel(); } });
  } else if (evSel.step === 'principal') {
    bar.innerHTML = `<div class="ev-bar-t"><b>VIDE ${L}</b> · passo 1 de 2: toque no ticket <b>principal</b></div>
      <div class="ev-bar-row"><span class="ev-bar-hint">O principal fica destacado; os outros serão vinculados a ele.</span><button type="button" class="ev-bar-btn" data-b="cancel">Cancelar</button></div>`;
  } else {
    const title = evSel.k === 'vide' ? `<b>VIDE ${escapeHtml(evSel.pt)}</b> · passo 2 de 2: selecione os ${L}s vinculados` : `<b>${escapeHtml(evSel.n)}</b> · ${evSel.edit ? 'toque para incluir ou tirar tickets' : 'passo 2 de 2: selecione os tickets envolvidos'}`;
    bar.innerHTML = `<div class="ev-bar-t">${title}</div>
      <div class="ev-bar-row"><span class="ev-bar-hint"><b>${n}</b> selecionado${n === 1 ? '' : 's'}${evSel.k === 'vide' ? ' + principal' : ''}</span>
      <button type="button" class="ev-bar-btn pri" data-b="done" ${evSel.k === 'evento' && !n ? 'disabled' : ''}>Concluir</button><button type="button" class="ev-bar-btn" data-b="cancel">Cancelar</button></div>`;
  }
  bar.querySelectorAll('[data-b]').forEach(x => x.onclick = () => ({ next: _evNext, cancel: cancelEvSel, done: finishEvSel })[x.dataset.b]());
}
function _evPaintSel() {
  const ov = document.getElementById('modal-overlay');
  ov?.classList.toggle('ev-selecting', !!evSel && evSel.step !== 'name');
  ov?.classList.toggle('ev-picking-principal', !!evSel && evSel.step === 'principal');
  _evRows().forEach(r => {
    const id = r.dataset.identity;
    r.classList.toggle('ev-chosen', !!evSel && evSel.chosen.has(id));
    r.classList.toggle('ev-sel-principal', !!evSel && evSel.pi === id);
    const other = evOf(id);
    r.classList.toggle('ev-in-other', !!evSel && evSel.step === 'pick' && !!other && other.id !== evSel.id);
  });
}
function startEventFlow() { evSel = { k: 'evento', step: 'name', id: _evNewId(), n: '', chosen: new Set(), before: new Set() }; _evRenderBar(); _evPaintSel(); }
function startVideFlow()  { evSel = { k: 'vide', step: 'principal', id: _evNewId(), n: '', chosen: new Set(), before: new Set() }; _evRenderBar(); _evPaintSel(); }
function _evNext() {
  const v = (document.getElementById('ev-name-in')?.value || '').trim();
  if (!v) { document.getElementById('ev-name-in')?.focus(); return _evToast('Digite o nome do evento', false); }
  evSel.n = v; evSel.step = 'pick'; _evRenderBar(); _evPaintSel();
}
function cancelEvSel() { evSel = null; _evRenderBar(); _evPaintSel(); }
async function finishEvSel() {
  const s = evSel; if (!s) return;
  const ids = [...s.chosen];
  if (s.k === 'vide' && s.pi) ids.unshift(s.pi);
  if (!ids.length || (s.k === 'vide' && ids.length < 2)) return _evToast(s.k === 'vide' ? 'Selecione pelo menos 1 ticket para vincular ao principal' : 'Selecione pelo menos 1 ticket', false);
  const clear = [...s.before].filter(id => !ids.includes(id));
  const ev = { id: s.id, n: s.k === 'vide' ? `VIDE ${s.pt}` : s.n, k: s.k, pt: s.pt || '', pi: s.pi || '' };
  evSel = null; _evRenderBar(); _evPaintSel();
  await evSave(ids, clear, ev);
  _evToast(`${s.k === 'vide' ? 'VIDE' : 'Evento'} "${ev.n}" com ${ids.length} ticket${ids.length > 1 ? 's' : ''}`);
}
function editEvent(evId) {
  const g = evInList().get(evId); if (!g) return;
  const e = g.ev, ids = g.ids.filter(id => id !== e.pi);
  evSel = { k: e.k, step: 'pick', edit: true, id: e.id, n: e.n, pi: e.pi, pt: e.pt, chosen: new Set(e.k === 'vide' ? ids : g.ids), before: new Set(g.ids) };
  _evRenderBar(); _evPaintSel();
  document.getElementById('modal-body-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
}
async function dissolveEvent(evId) {
  const g = evInList().get(evId); if (!g) return;
  if (!confirm(`Desfazer "${g.ev.n}"? Os ${g.ids.length} tickets voltam para a lista normal (notas e classificações não mudam).`)) return;
  [...tagFilter].forEach(k => { if (k === 'ev:' + evId) tagFilter.delete(k); });
  await evSave([], g.ids, {});
  _evToast(`"${g.ev.n}" desfeito`);
}

/* Toques nos cartões durante a seleção (não abre links nem botões do cartão).
   Fica na janela (window) para rodar antes dos outros cliques do cartão. */
window.addEventListener('click', e => {
  if (!evSel || evSel.step === 'name') return;
  const row = e.target.closest && e.target.closest('#modal-tbody tr.ticket-row');
  if (!row) return;
  e.preventDefault(); e.stopPropagation();
  const id = row.dataset.identity;
  if (evSel.step === 'principal') {
    evSel.pi = id; evSel.pt = row.dataset.ticket || '';
    evSel.chosen.delete(id); evSel.step = 'pick';
    const cur = evOf(id);   /* o principal já era de um VIDE: continua o mesmo grupo */
    if (cur && cur.k === 'vide' && cur.pi === id) { const g = evInList().get(cur.id); evSel.id = cur.id; evSel.before = new Set(g ? g.ids : []); g?.ids.forEach(x => x !== id && evSel.chosen.add(x)); evSel.edit = true; }
  } else {
    if (id === evSel.pi) return;
    evSel.chosen.has(id) ? evSel.chosen.delete(id) : evSel.chosen.add(id);
  }
  _evRenderBar(); _evPaintSel();
}, true);

/* Botões do cabeçalho do subgrupo (captura: a janela da lista bloqueia cliques que "sobem") */
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('#modal-tbody [data-evact]');
  if (!b || evSel) return;
  e.stopPropagation();
  const id = b.closest('tr').dataset.ev;
  ({ copy: () => copyEvent(id, b), edit: () => editEvent(id), del: () => dissolveEvent(id) })[b.dataset.evact]();
}, true);

/* ══════════ Integração com "Filtrar status" e cópias ══════════ */
document.addEventListener('DOMContentLoaded', () => {
  _evButton();

  /* Linha de vínculo no texto copiado de cada ticket */
  if (typeof formatTicketWA === 'function') {
    const _f = formatTicketWA;
    formatTicketWA = function (item, isRal) {
      const t = _f.apply(this, arguments);
      const id = makeIdentity(isRal ? 'ral' : 'rec', item), e = evOf(id);
      if (!e) return t;
      const line = e.k === 'vide' ? (e.pi === id ? `⭐ *PRINCIPAL* (VIDE)` : `🔗 VIDE ${e.pt}`) : `🧩 Evento: ${e.n}`;
      const L = t.split('\n'); L.splice(1, 0, line); return L.join('\n');
    };
  }

  /* Reorganiza os subgrupos sempre que a lista é redesenhada/reordenada */
  for (const name of ['applyTicketStatesToTbody', 'applyPinnedSort', 'sortModalTable']) {
    if (typeof window[name] !== 'function') continue;
    const orig = window[name];
    window[name] = function () { const r = orig.apply(this, arguments); layoutEventGroups(); if (evSel) _evPaintSel(); return r; };
  }
  const _open = openModal;
  openModal = function () { cancelEvSel(); removeAssocMenu(); [...tagFilter].forEach(k => k.startsWith('ev:') && tagFilter.delete(k)); const r = _open.apply(this, arguments); setTimeout(() => { layoutEventGroups(); if (typeof applyTagFilter === 'function') applyTagFilter(); }, 0); return r; };
  const _close = closeModal;
  closeModal = function () { if (evSel) { cancelEvSel(); return; } removeAssocMenu(); return _close.apply(this, arguments); };   /* 1º fecha a seleção */
  const _flt = typeof filterModalTable === 'function' ? filterModalTable : null;
  if (_flt) filterModalTable = function () { const r = _flt.apply(this, arguments); _evSyncVisibility(); return r; };

  /* Filtro: eventos entram como 'ev:<id>' no mesmo conjunto das classificações */
  const _apply = applyTagFilter;
  applyTagFilter = function () {
    const evKeys = [...tagFilter].filter(k => k.startsWith('ev:'));
    if (!evKeys.length) { const r = _apply.apply(this, arguments); _evSyncVisibility(); _evRelabel(); return r; }
    _apply.apply(this, arguments);
    document.querySelectorAll('#modal-tbody tr.ticket-row').forEach(r => {
      const k = getTicketTag(r.dataset.eventColor) ? r.dataset.eventColor : 'none';
      const e = evOf(r.dataset.identity);
      r.classList.toggle('tag-hidden', !(tagFilter.has(k) || (e && tagFilter.has('ev:' + e.id))));
    });
    document.querySelector('#modal-tbody .tf-empty-row')?.remove();
    _evSyncVisibility(); _evRelabel();
  };

  /* Menu do filtro: acrescenta a seção "Eventos" */
  const _menu = toggleTagFilterMenu;
  toggleTagFilterMenu = function (btn) {
    const r = _menu.apply(this, arguments);
    const m = document.getElementById('tag-filter-menu');
    const groups = evInList();
    const stale = [...tagFilter].filter(k => k.startsWith('ev:') && !groups.has(k.slice(3)));
    stale.forEach(k => tagFilter.delete(k));
    if (!m || !groups.size) return r;
    const html = `<div class="tf-sec">Eventos</div>` + [...groups.values()].map(({ ev, ids }) =>
      `<label class="tf-opt tf-ev" style="--c:${evColor(ev.id)};--fg:#06101d">
        <input type="checkbox" value="ev:${ev.id}" ${tagFilter.has('ev:' + ev.id) ? 'checked' : ''}>
        <span class="tf-name">${ev.k === 'vide' ? '🔗 ' : '🧩 '}${escapeHtml(ev.n)}</span><span class="tf-count">${ids.length}</span>
      </label>`).join('');
    const head = m.querySelector('.tag-picker-head');
    head.insertAdjacentHTML('afterend', html + '<div class="tf-sec">Classificação</div>');
    m.querySelector('.tf-hint')?.remove();
    return r;
  };

  /* Copiar selecionados: inclui os tickets dos eventos marcados */
  const _copySel = copySelectedWA;
  copySelectedWA = async function (btn) {
    const evKeys = [...tagFilter].filter(k => k.startsWith('ev:'));
    if (!evKeys.length) return _copySel.apply(this, arguments);
    const tagKeys = [...tagFilter].filter(k => !k.startsWith('ev:'));
    const tk = _evTk(), isRal = tk === 'ral';
    const list = (modalData[tk] && modalData[tk][appState.currentModalKey]) || [];
    const parts = [], used = new Set();
    for (const k of evKeys) {
      const { items, ev } = _evItemsOf(k.slice(3));
      if (!items.length) continue;
      items.forEach(i => used.add(makeIdentity(tk, i)));
      parts.push(evHeadText(ev, items.length) + '\n\n' + items.map(i => formatTicketWA(i, isRal)).join('\n\n'));
    }
    if (tagKeys.length) {
      const keyOf = i => { const kk = (appState.ticketStates[makeIdentity(tk, i)] || {}).eventColor; return getTicketTag(kk) ? kk : 'none'; };
      const more = list.filter(i => !used.has(makeIdentity(tk, i)) && tagKeys.includes(keyOf(i)));
      if (more.length) parts.push(`🏷️ *${tagKeys.map(k => k === 'none' ? 'Sem classificação' : getTicketTag(k).label).join(' · ')}*\n\n` + more.map(i => formatTicketWA(i, isRal)).join('\n\n'));
      more.forEach(i => used.add(makeIdentity(tk, i)));
    }
    if (!parts.length) return _evToast('Nenhum ticket nos itens selecionados', false);
    const title = (document.getElementById('modal-title')?.textContent || '').trim();
    const text = `🚨 *COP REDE — ${title}*\n\n` + parts.join('\n\n━━━━━━━━━━\n\n');
    const ok = await _waWrite(text);
    if (typeof _waFlash === 'function') _waFlash(btn, ok);
    _evToast(ok ? `${used.size} copiado${used.size > 1 ? 's' : ''} — cole no WhatsApp` : 'Não foi possível copiar', ok);
  };
});

/* Nome do evento no botão "Filtrar status" quando só ele está marcado */
function _evRelabel() {
  const b = document.getElementById('tag-filter-btn'); if (!b) return;
  if (tagFilter.size === 1) {
    const k = [...tagFilter][0];
    if (k.startsWith('ev:')) { const g = evInList().get(k.slice(3)); const t = b.querySelector('.tf-text'); if (t) t.textContent = g ? g.ev.n : 'Evento'; }
  }
}
