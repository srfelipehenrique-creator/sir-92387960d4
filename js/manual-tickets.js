/* ══════════════════════════════════════════════════════════════
   v101 — INSERIR RAL / REC MANUALMENTE (tela do CF)
   - Botão "+ Inserir" no topo da tela do CF: tipo (RAL/REC), número, CF,
     designação, abertura e Tipo RAL / Cliente.
   - Ao salvar, confere se o ticket já existe no painel:
       · já existe → atualiza as informações do ticket (CF, designação,
         abertura, tipo/cliente) e mantém notas, classificação e registros;
       · não existe → entra no CF escolhido, marcado como MANUAL.
   - Quando o SIR passar a trazer o ticket (ou trouxer dados novos dele),
     valem os dados do SIR; o registro manual sai e as notas, a classificação
     e os registros continuam (apelido de identidade, utils.js).
   - Diferença sutil na tela: selo "MANUAL" e borda tracejada à esquerda.
   - Guardado neste aparelho (sir_manual_tickets_v1), por até 7 dias.
   ══════════════════════════════════════════════════════════════ */

const LS_MANUAL = 'sir_manual_tickets_v1';   /* { items: [{ tk, item, at, by, fp, existia }] } */
const MANUAL_DIAS = 7;
const MANUAL_TIPOS_RAL = ['ACESSO CLIENTE', 'BACKBONE', 'COLETOR', 'FOTÔNICA', 'PPC'];

function _mtRead() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_MANUAL) || 'null');
    if (v && Array.isArray(v.items)) {
      const lim = Date.now() - MANUAL_DIAS * 86400000;
      v.items = v.items.filter(r => r && r.item && r.item.ticket && (r.at || 0) >= lim);
      return v;
    }
  } catch (e) {}
  return { items: [] };
}
function _mtWrite(v) { try { localStorage.setItem(LS_MANUAL, JSON.stringify(v)); } catch (e) {} }
function _mtUser() { try { return localStorage.getItem('sir_user_name') || ''; } catch (e) { return ''; } }

function _mtPattern(cf) {
  for (const cfs of Object.values(REGIONS)) if (cfs[cf]) return cfs[cf][0];
  return null;
}
function _mtCfDoPadrao(p) {
  for (const cfs of Object.values(REGIONS)) for (const [cf, ps] of Object.entries(cfs)) if (ps.includes(p)) return cf;
  return null;
}
function _mtCampos(item) {
  return { ticket: item.ticket, cfOrigem: item.cfOrigem, designacao: item.designacao || '', abertura: item.abertura || '', extra: item.extra || '' };
}

/* "757238/2026", "REC 757238/2026", "rec-757238/2026" → "REC-757238/2026" */
function _mtNormNumero(tk, txt) {
  const m = String(txt || '').match(/(?:\b(RAL|REC)\s*[-–]?\s*)?(\d{4,8})\s*\/\s*(20\d\d)/i);
  if (!m) return null;
  return `${tk.toUpperCase()}-${m[2]}/${m[3]}`;
}

/* ───────── Junta os manuais aos dados (chamada em onDataReady) ───────── */
function mergeManualTickets(ralRes, recRes) {
  const st = _mtRead();
  if (!st.items.length) { _mtWrite(st); return; }
  const fp = appState.sourceFp || '';
  const agora = Date.now();
  ralRes.details = ralRes.details || {}; ralRes.counts = ralRes.counts || {};
  recRes.details = recRes.details || {}; recRes.counts = recRes.counts || {};

  /* Onde cada ticket está nos dados do SIR */
  const onde = { ral: new Map(), rec: new Map() };
  for (const [tk, res] of [['ral', ralRes], ['rec', recRes]])
    for (const p in res.details) (res.details[p] || []).forEach((it, idx) => onde[tk].set(normTicket(it.ticket), { p, idx, it }));
  const qual = new Set();
  for (const p in (ralRes.qualidadeDetails || {})) for (const it of ralRes.qualidadeDetails[p] || []) qual.add(normTicket(it.ticket));

  const manter = [];
  let mudou = false;
  for (const r of st.items) {
    const tk = r.tk === 'rec' ? 'rec' : 'ral', res = tk === 'rec' ? recRes : ralRes;
    const key = normTicket(r.item.ticket);
    const canonica = makeIdentity(tk, r.item);
    const achou = onde[tk].get(key);

    if (achou) {
      /* O SIR tem o ticket: as notas/classificação seguem para a identidade do SIR */
      setIdentityAlias(makeIdentityRaw(tk, achou.it), canonica);
      const siratualizou = (fp && r.fp) ? fp !== r.fp : (agora - (r.at || 0) > 30 * 60000);
      if (siratualizou) { mudou = true; continue; }        /* dados novos do SIR: valem os do SIR */
      /* Ainda é a mesma leitura do SIR: mostra o que foi digitado */
      const novo = { ...achou.it, ..._mtCampos(r.item), manual: 'edit', manualBy: r.by || '', manualAt: r.at };
      const pNovo = _mtPattern(novo.cfOrigem) || achou.p;
      if (pNovo !== achou.p) {
        res.details[achou.p].splice(res.details[achou.p].indexOf(achou.it), 1);
        res.counts[achou.p] = Math.max(0, (res.counts[achou.p] || 1) - 1);
        (res.details[pNovo] = res.details[pNovo] || []).push(novo);
        res.counts[pNovo] = (res.counts[pNovo] || 0) + 1;
      } else {
        res.details[achou.p][res.details[achou.p].indexOf(achou.it)] = novo;
      }
      setIdentityAlias(makeIdentityRaw(tk, novo), canonica);
      manter.push(r);
      continue;
    }
    if (tk === 'ral' && qual.has(key)) { manter.push(r); continue; }   /* está em RAL Qualidade: não duplica */

    const p = _mtPattern(r.item.cfOrigem);
    if (!p) { manter.push(r); continue; }
    const it = { ..._mtCampos(r.item), manual: true, manualBy: r.by || '', manualAt: r.at };
    (res.details[p] = res.details[p] || []).push(it);
    res.counts[p] = (res.counts[p] || 0) + 1;
    res.total = (res.total || 0) + 1;
    onde[tk].set(key, { p, idx: res.details[p].length - 1, it });
    manter.push(r);
  }
  if (mudou || manter.length !== st.items.length) {
    const sairam = st.items.length - manter.length;
    if (sairam > 0 && typeof showActionToast === 'function')
      showActionToast(`${sairam} ticket(s) inserido(s) à mão agora vêm do SIR — notas e classificação mantidas.`, 'success');
  }
  _mtWrite({ items: manter });
}

/* ───────── Salvar (formulário) ───────── */
function _mtAcharNoPainel(tk, ticket) {
  const key = normTicket(ticket);
  const listas = [modalData[tk] && modalData[tk].ALL || []];
  if (tk === 'ral' && typeof QKEY !== 'undefined') listas.push(modalData.ral[QKEY + 'ALL'] || []);
  for (const l of listas) { const it = l.find(i => normTicket(i.ticket) === key); if (it) return it; }
  return null;
}

function salvarTicketManual(dados) {
  const tk = dados.tk === 'rec' ? 'rec' : 'ral';
  const ticket = _mtNormNumero(tk, dados.numero);
  if (!ticket) return { erro: 'Número inválido. Use o formato 757238/2026.' };
  if (!_mtPattern(dados.cf)) return { erro: 'Escolha o CF.' };

  const st = _mtRead();
  const anterior = st.items.find(r => r.tk === tk && normTicket(r.item.ticket) === normTicket(ticket));
  const existente = _mtAcharNoPainel(tk, ticket);
  const base = existente ? _mtCampos(existente) : (anterior ? _mtCampos(anterior.item) : { ticket, cfOrigem: dados.cf, designacao: '', abertura: '', extra: '' });
  /* Campo em branco = mantém o que o ticket já tinha */
  const item = {
    ticket,
    cfOrigem: dados.cf || base.cfOrigem,
    designacao: dados.designacao.trim() || base.designacao,
    abertura: dados.abertura.trim() || base.abertura,
    extra: dados.extra.trim() || base.extra
  };
  /* Notas, classificação e registros ficam na identidade que o ticket já tinha */
  const canonica = existente ? makeIdentity(tk, existente) : (anterior ? makeIdentity(tk, anterior.item) : null);
  if (canonica) setIdentityAlias(makeIdentityRaw(tk, item), canonica);

  const reg = { tk, item, at: Date.now(), by: _mtUser(), fp: appState.sourceFp || '', existia: !!existente };
  st.items = st.items.filter(r => r !== anterior);
  st.items.push(reg);
  _mtWrite(st);
  return { ok: true, existia: !!existente, ticket };
}

function removerTicketManual(tk, ticket) {
  const st = _mtRead();
  const antes = st.items.length;
  st.items = st.items.filter(r => !(r.tk === tk && normTicket(r.item.ticket) === normTicket(ticket)));
  if (st.items.length === antes) return;
  _mtWrite(st);
  if (typeof showActionToast === 'function') showActionToast(`${ticket} removido da inserção manual`, 'success');
  if (typeof loadNow === 'function') loadNow();
}

/* ───────── Janela ───────── */
function _mtCfAtual() {
  let k = String(appState.currentModalKey || '');
  if (typeof QKEY !== 'undefined' && k.startsWith(QKEY)) k = k.slice(QKEY.length);
  return _mtPattern(k) ? k : '';
}
function _mtAgoraTxt() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function abrirInserirManual() {
  const ov = _mtJanela();
  const tk = appState.currentModalType === 'rec' ? 'rec' : 'ral';
  ov.querySelector(`input[name="mt-tk"][value="${tk}"]`).checked = true;
  ov.querySelector('#mt-num').value = '';
  ov.querySelector('#mt-cf').value = _mtCfAtual() || ov.querySelector('#mt-cf').value;
  ov.querySelector('#mt-desig').value = '';
  ov.querySelector('#mt-ab').value = '';
  ov.querySelector('#mt-ab').placeholder = _mtAgoraTxt();
  ov.querySelector('#mt-extra').value = '';
  ov.querySelector('.mt-aviso').textContent = '';
  _mtTipoMudou();
  ov.classList.add('active');
  setTimeout(() => ov.querySelector('#mt-num').focus(), 60);
}
function fecharInserirManual() { document.getElementById('manual-ticket-modal')?.classList.remove('active'); }

function _mtTipoMudou() {
  const ov = document.getElementById('manual-ticket-modal');
  if (!ov) return;
  const ral = ov.querySelector('input[name="mt-tk"]:checked').value === 'ral';
  ov.querySelector('.mt-extra-lbl').textContent = ral ? 'Tipo RAL' : 'Cliente';
  ov.querySelector('#mt-extra').setAttribute('list', ral ? 'mt-tipos-ral' : '');
  ov.querySelector('#mt-extra').placeholder = ral ? 'Ex.: BACKBONE' : 'Ex.: DROGASIL';
  _mtConferir();
}
/* Avisa, enquanto digita, se o ticket já está no painel */
function _mtConferir() {
  const ov = document.getElementById('manual-ticket-modal');
  if (!ov) return;
  const tk = ov.querySelector('input[name="mt-tk"]:checked').value;
  const t = _mtNormNumero(tk, ov.querySelector('#mt-num').value);
  const av = ov.querySelector('.mt-aviso');
  const ex = t && _mtAcharNoPainel(tk, t);
  av.textContent = ex ? `${t} já está no painel (CF ${ex.cfOrigem}). Ao salvar, as informações são atualizadas; notas, classificação e registros ficam como estão. Campo em branco mantém o valor atual.` : '';
  ov.querySelector('.mt-salvar').textContent = ex ? 'Atualizar ticket' : 'Inserir ticket';
}

function _mtSalvarForm() {
  const ov = document.getElementById('manual-ticket-modal');
  const r = salvarTicketManual({
    tk: ov.querySelector('input[name="mt-tk"]:checked').value,
    numero: ov.querySelector('#mt-num').value,
    cf: ov.querySelector('#mt-cf').value,
    designacao: ov.querySelector('#mt-desig').value,
    abertura: ov.querySelector('#mt-ab').value || (ov.querySelector('#mt-num').value ? _mtAgoraTxt() : ''),
    extra: ov.querySelector('#mt-extra').value.toUpperCase()
  });
  if (r.erro) { ov.querySelector('.mt-aviso').textContent = r.erro; ov.querySelector('#mt-num').focus(); return; }
  fecharInserirManual();
  if (typeof showActionToast === 'function')
    showActionToast(r.existia ? `${r.ticket} atualizado — notas, classificação e registros mantidos` : `${r.ticket} inserido manualmente`, 'success');
  if (typeof loadNow === 'function') loadNow();
}

function _mtJanela() {
  let ov = document.getElementById('manual-ticket-modal');
  if (ov) return ov;
  const cfs = [];
  for (const [rn, grupo] of Object.entries(REGIONS)) for (const cf of Object.keys(grupo)) cfs.push(`<option value="${escapeHtml(cf)}">${escapeHtml(cf)} · ${escapeHtml(rn)}</option>`);
  ov = document.createElement('div');
  ov.className = 'modal-overlay mpe-overlay'; ov.id = 'manual-ticket-modal';
  ov.innerHTML = `<div class="modal-content mpe-box mt-box" role="dialog" aria-modal="true" aria-labelledby="mt-tit" onclick="event.stopPropagation()">
    <div class="modal-header">
      <div><div class="modal-title" id="mt-tit">Inserir RAL / REC manualmente</div>
      <div class="mpe-sub">Se o ticket já existir, só as informações dele são atualizadas.</div></div>
      <button class="modal-close-btn" onclick="fecharInserirManual()" aria-label="Fechar">&times;</button>
    </div>
    <form class="mpe-body mt-form" onsubmit="event.preventDefault(); _mtSalvarForm();">
      <div class="mt-seg" role="radiogroup" aria-label="Tipo de ticket">
        <label><input type="radio" name="mt-tk" value="ral" onchange="_mtTipoMudou()"> RAL</label>
        <label><input type="radio" name="mt-tk" value="rec" onchange="_mtTipoMudou()"> REC</label>
      </div>
      <div class="mt-grid">
        <label class="mt-campo"><span>Número *</span><input id="mt-num" class="mpe-input" required placeholder="757238/2026" autocomplete="off" oninput="_mtConferir()"></label>
        <label class="mt-campo"><span>CF *</span><select id="mt-cf" class="mpe-input">${cfs.join('')}</select></label>
        <label class="mt-campo"><span>Designação</span><input id="mt-desig" class="mpe-input" placeholder="RJO/IP/34758" autocomplete="off"></label>
        <label class="mt-campo"><span>Abertura</span><input id="mt-ab" class="mpe-input" autocomplete="off"></label>
        <label class="mt-campo mt-largo"><span class="mt-extra-lbl">Tipo RAL</span><input id="mt-extra" class="mpe-input" autocomplete="off"></label>
      </div>
      <datalist id="mt-tipos-ral">${MANUAL_TIPOS_RAL.map(t => `<option value="${t}">`).join('')}</datalist>
      <div class="mt-aviso" aria-live="polite"></div>
      <div class="mpe-acoes">
        <span class="mpe-esp"></span>
        <button type="button" class="mpe-btn" onclick="fecharInserirManual()">Cancelar</button>
        <button type="submit" class="mpe-btn mpe-btn-pri mt-salvar">Inserir ticket</button>
      </div>
    </form>
  </div>`;
  ov.addEventListener('click', fecharInserirManual);
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') fecharInserirManual(); });
  document.body.appendChild(ov);
  return ov;
}

/* Selo MANUAL na linha/cartão (chamado por modal.js) */
function manualSeloHTML(tk, item) {
  if (!item || !item.manual) return '';
  const quando = item.manualAt ? new Date(item.manualAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '';
  const quem = [item.manualBy, quando].filter(Boolean).join(' · ');
  const txt = item.manual === 'edit' ? 'Informações atualizadas à mão' : 'Inserido à mão (não veio do SIR)';
  return `<button type="button" class="manual-badge" data-mt-tk="${tk}" data-mt-ticket="${escapeHtml(item.ticket)}"
    title="${escapeHtml(txt + (quem ? ' — ' + quem : ''))}. Clique para desfazer.">MANUAL</button>`;
}

/* Botão no topo da tela do CF (ao lado de Associar) */
function _mtBotao() {
  if (document.getElementById('btn-modal-manual')) return;
  const ref = document.getElementById('btn-modal-assoc') || document.getElementById('btn-modal-copy-sel');
  if (!ref) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'btn-modal-manual'; b.className = 'modal-csv-btn btn-manual';
  b.textContent = 'Inserir'; b.setAttribute('aria-label', 'Inserir ticket manualmente'); b.title = 'Inserir RAL ou REC manualmente (se já existir, atualiza as informações)';
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (typeof isHfcKey === 'function' && isHfcKey(appState.currentModalKey)) abrirInserirHfc();   /* v102 */
    else abrirInserirManual();
  });
  ref.insertAdjacentElement('afterend', b);
}
document.addEventListener('DOMContentLoaded', () => setTimeout(_mtBotao, 0));
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('.manual-badge[data-mt-ticket]');
  if (!b) return;
  e.stopPropagation();
  if (confirm(`Desfazer a inserção manual de ${b.dataset.mtTicket}? As notas continuam.`)) removerTicketManual(b.dataset.mtTk, b.dataset.mtTicket);
}, true);
