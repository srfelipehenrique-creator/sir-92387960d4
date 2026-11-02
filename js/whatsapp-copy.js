/* ══════════════════════════════════════════════════════════════
   Copiar RAL/REC formatado para WhatsApp
   - Botão "Copiar" em cada ticket da lista
   - Botão "Copiar todos" no topo da lista (respeita o filtro)
   Usa *negrito* do WhatsApp. SLA é calculado no momento da cópia.
   ══════════════════════════════════════════════════════════════ */

function _waSla(abertura, isRal) {
  const r = calcSla(abertura || '', isRal);
  if (!r) return '';
  const fmt = ms => {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
  };
  return r.remaining <= 0
    ? `SLA PERDIDO (+${fmt(Math.abs(r.remaining))})`
    : `${fmt(r.remaining)} restantes (${isRal ? '6h' : '4h'})`;
}

function _waTicketLabel(ticket, isRal) {
  const t = String(ticket || 'N/D').trim();
  return /^[A-Za-z]/.test(t) ? t : `${isRal ? 'RAL' : 'REC'} ${t}`;
}

function formatTicketWA(item, isRal) {
  const st = appState.ticketStates[makeIdentity(isRal ? 'ral' : 'rec', item)] || {};
  const status = st.obsStatus && st.obsStatus !== 'none'
    ? (OBS_STATUSES.find(s => s.key === st.obsStatus) || {}).label : '';
  const lines = [
    `*${_waTicketLabel(item.ticket, isRal)}* — CF ${item.cfOrigem || 'N/D'}`,
    `Designação: ${item.designacao || 'N/D'}`,
  ];
  if (item.extra && item.extra !== 'N/D') lines.push(`${isRal ? 'Tipo' : 'Cliente'}: ${item.extra}`);
  if (item.abertura) lines.push(`Abertura: ${item.abertura}`);
  const sla = _waSla(item.abertura, isRal);
  if (sla) lines.push(`SLA: ${sla}`);
  if (st.obs) lines.push(`Nota: ${st.obs}`);
  if (status) lines.push(`Status: ${status}`);
  return lines.join('\n');
}

function _waCurrentList() {
  const tk = appState.currentModalType, key = appState.currentModalKey;
  return { tk, isRal: tk === 'ral', list: (tk && modalData[tk] && modalData[tk][key]) || [] };
}

async function _waWrite(text) {
  try {
    if (navigator.clipboard && window.isSecureContext !== false) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* tenta o método antigo abaixo */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px;';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

function _waFlash(btn, ok) {
  if (!btn) return;
  const old = btn.dataset.label || btn.textContent;
  btn.dataset.label = old;
  btn.textContent = ok ? 'Copiado ✓' : 'Falhou';
  btn.classList.toggle('copied', ok);
  clearTimeout(btn._waT);
  btn._waT = setTimeout(() => { btn.textContent = old; btn.classList.remove('copied'); }, 1600);
}

async function copyTicketWA(btn) {
  const row = btn.closest('tr.ticket-row');
  if (!row) return;
  const { tk, isRal, list } = _waCurrentList();
  const id = row.dataset.identity;
  const item = list.find(i => makeIdentity(tk, i) === id)
            || (modalData[tk]['ALL'] || []).find(i => makeIdentity(tk, i) === id);
  if (!item) return;
  const ok = await _waWrite(formatTicketWA(item, isRal));
  _waFlash(btn, ok);
  if (typeof showActionToast === 'function')
    showActionToast(ok ? 'Copiado — cole no WhatsApp' : 'Não foi possível copiar', ok ? 'success' : 'error');
}

async function copyAllWA(btn) {
  const { tk, isRal, list } = _waCurrentList();
  if (!list.length) return;
  /* Mesmo critério do campo "Filtrar tickets..." */
  const q = (document.getElementById('modal-filter-input')?.value || '').toLowerCase().trim();
  const items = !q ? list : list.filter(i =>
    [i.ticket, i.cfOrigem, i.designacao, i.extra, i.abertura].join(' ').toLowerCase().includes(q));
  if (!items.length) return;

  /* Mantém a ordem que está na tela (ordenação e fixados) quando possível */
  const byId = new Map(items.map(i => [makeIdentity(tk, i), i]));
  const rows = Array.from(document.querySelectorAll('#modal-tbody tr.ticket-row'))
    .filter(r => r.style.display !== 'none' && byId.has(r.dataset.identity));
  const ordered = rows.length === items.length
    ? rows.map(r => byId.get(r.dataset.identity))
    : items.slice().sort((a, b) => parseAbertura(b.abertura) - parseAbertura(a.abertura));

  const title = (document.getElementById('modal-title')?.textContent || '').trim();
  const now = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const head = `*COP REDE — ${title}*\n${items.length} ${isRal ? 'RAL' : 'REC'}${items.length > 1 ? 's' : ''} · ${now}`;
  const text = head + '\n\n' + ordered.map(i => formatTicketWA(i, isRal)).join('\n\n');

  const ok = await _waWrite(text);
  _waFlash(btn, ok);
  if (typeof showActionToast === 'function')
    showActionToast(ok ? `${items.length} copiado${items.length > 1 ? 's' : ''} — cole no WhatsApp` : 'Não foi possível copiar', ok ? 'success' : 'error');
}
