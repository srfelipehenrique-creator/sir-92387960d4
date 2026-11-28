/* ══════════════════════════════════════════════════════════════
   v102 — HFC: acompanhamento por CF (sem base de dados)
   - Botão "HFC" em cada card de CF, ao lado de RAL / REC / QUAL.
   - Tudo é inserido à mão (botão "Inserir" na aba HFC da tela do CF).
     O número do ticket é o OUTAGE.
   - SLA por tipo: PERFORMANCE = 6h · INTERRUPÇÃO = 4h.
   - Mesma tela de RAL/REC: notas, classificação, status, inserir evento,
     copiar, associar, filtro e CSV. Lista em modalData.ral['H:<área>'].
   - Se o OUTAGE já existe, só as informações são atualizadas (notas,
     classificação e registros ficam). "Encerrar" tira o OUTAGE da tela.
   - Guardado neste aparelho (sir_hfc_v1).
   ══════════════════════════════════════════════════════════════ */

const HKEY = 'H:';
const LS_HFC = 'sir_hfc_v1';   /* { items: [{ ticket, cfOrigem, designacao, abertura, extra, by, at }] } */
const HFC_TIPOS = { 'PERFORMANCE': 6, 'INTERRUPÇÃO': 4 };

function isHfcKey(k) { return typeof k === 'string' && k.startsWith(HKEY); }
function hfcSlaHoras(tipo) { return String(tipo || '').toUpperCase().startsWith('INTERRUP') ? 4 : 6; }

function _hfcRead() {
  try { const v = JSON.parse(localStorage.getItem(LS_HFC) || 'null'); if (v && Array.isArray(v.items)) return v; } catch (e) {}
  return { items: [] };
}
function _hfcWrite(v) { try { localStorage.setItem(LS_HFC, JSON.stringify(v)); } catch (e) {} }
function _hfcNorm(t) { return String(t || '').trim().toUpperCase().replace(/\s+/g, ''); }
function _hfcItem(r) {
  return { ticket: r.ticket, cfOrigem: r.cfOrigem, designacao: r.designacao || '', abertura: r.abertura || '',
    extra: r.extra || 'PERFORMANCE', slaH: hfcSlaHoras(r.extra), hfc: true, manualBy: r.by || '', manualAt: r.at };
}

/* ── Listas para a tela de tickets (chamada a cada atualização do painel) ── */
function buildHfcModalData(areas) {
  const all = _hfcRead().items.map(_hfcItem);
  const by = cfs => all.filter(i => cfs.includes(i.cfOrigem));
  for (const [rn, cfs] of Object.entries(REGIONS)) {
    const keys = Object.keys(cfs);
    keys.forEach(cf => { modalData.ral[HKEY + cf] = by([cf]); });
    modalData.ral[HKEY + rn] = by(keys);
  }
  modalData.ral[HKEY + 'ALL'] = all;
  modalData.ral[HKEY + 'MY_AREAS_V2'] = by(Array.isArray(areas) ? areas : []);
}
function hfcCount(key) { return ((modalData.ral && modalData.ral[HKEY + key]) || []).length; }

/* Redesenha painel e lista aberta depois de inserir/encerrar */
function _hfcAtualizarTela() {
  const areas = typeof getUserSavedAreas === 'function' ? getUserSavedAreas() : [];
  buildHfcModalData(areas);
  document.querySelectorAll('[data-hfc-cf]').forEach(b => {
    const n = hfcCount(b.dataset.hfcCf), v = b.querySelector('.v2-cell-val');
    if (v) { v.textContent = n; v.dataset.val = n; }
    b.classList.toggle('v2-zero', !n);
  });
  const ov = document.getElementById('modal-overlay');
  if (ov && ov.classList.contains('active') && isHfcKey(appState.currentModalKey))
    openModal(appState.currentModalKey, true, document.getElementById('modal-title')?.textContent || 'HFC');
}

/* ── Inserir / atualizar ── */
function salvarHfc(d) {
  const ticket = _hfcNorm(d.outage);
  if (!ticket) return { erro: 'Informe o número do OUTAGE.' };
  if (typeof REGIONS === 'undefined' || !Object.values(REGIONS).some(c => c[d.cf])) return { erro: 'Escolha o CF.' };
  const st = _hfcRead();
  const ant = st.items.find(r => _hfcNorm(r.ticket) === ticket);
  const novo = {
    ticket, cfOrigem: d.cf,
    designacao: d.designacao.trim() || (ant ? ant.designacao : ''),
    abertura: d.abertura.trim() || (ant ? ant.abertura : ''),
    extra: HFC_TIPOS[d.tipo] ? d.tipo : (ant ? ant.extra : 'PERFORMANCE'),
    by: ant ? ant.by : (localStorage.getItem('sir_user_name') || ''), at: ant ? ant.at : Date.now(), et: ant ? Date.now() : undefined
  };
  /* Notas, classificação e registros continuam no OUTAGE */
  if (ant && typeof setIdentityAlias === 'function')
    setIdentityAlias(makeIdentityRaw('ral', _hfcItem(novo)), makeIdentity('ral', _hfcItem(ant)));
  st.items = st.items.filter(r => r !== ant);
  st.items.push(novo);
  _hfcWrite(st);
  return { ok: true, existia: !!ant, ticket };
}
function encerrarHfc(ticket) {
  const st = _hfcRead(), k = _hfcNorm(ticket);
  const n = st.items.length;
  st.items = st.items.filter(r => _hfcNorm(r.ticket) !== k);
  if (st.items.length === n) return;
  _hfcWrite(st);
  if (typeof showActionToast === 'function') showActionToast(`OUTAGE ${ticket} encerrado e retirado da tela`, 'success');
  _hfcAtualizarTela();
}

/* ── Janela ── */
function abrirInserirHfc() {
  const ov = _hfcJanela();
  let base = String(appState.currentModalKey || '');
  if (isHfcKey(base)) base = base.slice(HKEY.length);
  const cfSel = ov.querySelector('#hfc-cf');
  if ([...cfSel.options].some(o => o.value === base)) cfSel.value = base;
  ov.querySelector('#hfc-out').value = '';
  ov.querySelector('#hfc-desig').value = '';
  ov.querySelector('#hfc-ab').value = '';
  ov.querySelector('#hfc-ab').placeholder = typeof _mtAgoraTxt === 'function' ? _mtAgoraTxt() : '';
  ov.querySelector('input[name="hfc-tipo"][value="PERFORMANCE"]').checked = true;
  _hfcConferir();
  ov.classList.add('active');
  setTimeout(() => ov.querySelector('#hfc-out').focus(), 60);
}
function fecharInserirHfc() { document.getElementById('hfc-modal')?.classList.remove('active'); }

function _hfcConferir() {
  const ov = document.getElementById('hfc-modal');
  if (!ov) return;
  const t = _hfcNorm(ov.querySelector('#hfc-out').value);
  const ex = t && _hfcRead().items.find(r => _hfcNorm(r.ticket) === t);
  ov.querySelector('.mt-aviso').textContent = ex
    ? `OUTAGE ${t} já está na tela (CF ${ex.cfOrigem}, ${ex.extra}). Ao salvar, as informações são atualizadas; notas, classificação e registros ficam. Campo em branco mantém o valor atual.` : '';
  ov.querySelector('.mt-salvar').textContent = ex ? 'Atualizar OUTAGE' : 'Inserir OUTAGE';
  const tipo = ov.querySelector('input[name="hfc-tipo"]:checked');
  ov.querySelector('.hfc-sla').textContent = `SLA: ${tipo ? HFC_TIPOS[tipo.value] : 6}h`;
}

function _hfcSalvarForm() {
  const ov = document.getElementById('hfc-modal');
  const outage = ov.querySelector('#hfc-out').value;
  const r = salvarHfc({
    outage, cf: ov.querySelector('#hfc-cf').value,
    designacao: ov.querySelector('#hfc-desig').value,
    abertura: ov.querySelector('#hfc-ab').value || (_hfcRead().items.some(x => _hfcNorm(x.ticket) === _hfcNorm(outage)) ? '' : (typeof _mtAgoraTxt === 'function' ? _mtAgoraTxt() : '')),
    tipo: (ov.querySelector('input[name="hfc-tipo"]:checked') || {}).value
  });
  if (r.erro) { ov.querySelector('.mt-aviso').textContent = r.erro; ov.querySelector('#hfc-out').focus(); return; }
  fecharInserirHfc();
  if (typeof showActionToast === 'function')
    showActionToast(r.existia ? `OUTAGE ${r.ticket} atualizado — notas, classificação e registros mantidos` : `OUTAGE ${r.ticket} inserido`, 'success');
  _hfcAtualizarTela();
}

function _hfcJanela() {
  let ov = document.getElementById('hfc-modal');
  if (ov) return ov;
  const cfs = [];
  for (const [rn, grupo] of Object.entries(REGIONS)) for (const cf of Object.keys(grupo)) cfs.push(`<option value="${escapeHtml(cf)}">${escapeHtml(cf)} · ${escapeHtml(rn)}</option>`);
  ov = document.createElement('div');
  ov.className = 'modal-overlay mpe-overlay'; ov.id = 'hfc-modal';
  ov.innerHTML = `<div class="modal-content mpe-box mt-box" role="dialog" aria-modal="true" aria-labelledby="hfc-tit" onclick="event.stopPropagation()">
    <div class="modal-header">
      <div><div class="modal-title" id="hfc-tit">Inserir HFC</div>
      <div class="mpe-sub">Se o OUTAGE já existir, só as informações dele são atualizadas.</div></div>
      <button class="modal-close-btn" onclick="fecharInserirHfc()" aria-label="Fechar">&times;</button>
    </div>
    <form class="mpe-body mt-form" onsubmit="event.preventDefault(); _hfcSalvarForm();">
      <div class="mt-seg" role="radiogroup" aria-label="Tipo de HFC">
        <label><input type="radio" name="hfc-tipo" value="PERFORMANCE" onchange="_hfcConferir()"> Performance · 6h</label>
        <label><input type="radio" name="hfc-tipo" value="INTERRUPÇÃO" onchange="_hfcConferir()"> Interrupção · 4h</label>
      </div>
      <div class="mt-grid">
        <label class="mt-campo"><span>OUTAGE *</span><input id="hfc-out" class="mpe-input" required placeholder="Número do OUTAGE" autocomplete="off" oninput="_hfcConferir()"></label>
        <label class="mt-campo"><span>CF *</span><select id="hfc-cf" class="mpe-input">${cfs.join('')}</select></label>
        <label class="mt-campo"><span>Designação / local</span><input id="hfc-desig" class="mpe-input" autocomplete="off"></label>
        <label class="mt-campo"><span>Abertura</span><input id="hfc-ab" class="mpe-input" autocomplete="off"></label>
      </div>
      <div class="hfc-sla mpe-sub"></div>
      <div class="mt-aviso" aria-live="polite"></div>
      <div class="mpe-acoes">
        <span class="mpe-esp"></span>
        <button type="button" class="mpe-btn" onclick="fecharInserirHfc()">Cancelar</button>
        <button type="submit" class="mpe-btn mpe-btn-pri mt-salvar">Inserir OUTAGE</button>
      </div>
    </form>
  </div>`;
  ov.addEventListener('click', fecharInserirHfc);
  ov.addEventListener('keydown', e => { if (e.key === 'Escape') fecharInserirHfc(); });
  document.body.appendChild(ov);
  return ov;
}

/* Número do OUTAGE na linha/cartão (sem link para o SIR) + botão Encerrar */
function hfcTicketHTML(item) {
  return `<span class="hfc-out" title="OUTAGE">${escapeHtml(item.ticket)}</span>`
    + `<button type="button" class="manual-badge hfc-encerrar" data-hfc-fim="${escapeHtml(item.ticket)}" title="Encerrar este OUTAGE (sai da tela; as notas ficam guardadas)">Encerrar</button>`;
}

/* ── Célula HFC no card do CF ── */
if (window.SirUI) {
  SirUI.celulaHfc = function ({ cf, valor, chave, titulo }) {
    const c = escapeHtml(cf);
    return `<button class="v2-cell v2-hfc${valor ? '' : ' v2-zero'}" data-hfc-cf="${c}" onclick="${SirUI.abrirLista(chave, true, titulo)}"
              title="HFC ${c}" aria-label="HFC ${c}: ${SirUI.plural(valor, 'OUTAGE', 'OUTAGEs')}">
      <span class="v2-cell-lbl">HFC</span>
      <span class="v2-cell-val animate-num" data-val="${valor}">${valor}</span>
    </button>`;
  };
  const _card = SirUI.cardCF;
  SirUI.cardCF = function (p) {
    const html = _card.apply(this, arguments);
    const cel = SirUI.celulaHfc({ cf: p.cf, valor: hfcCount(p.cf), chave: HKEY + p.cf, titulo: listTitle('hfc', p.cf) });
    /* entra logo depois da célula QUAL */
    return html.replace(/(<button class="v2-cell v2-qual[\s\S]*?<\/button>)/, `$1\n      ${cel}`);
  };
}

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-hfc-fim]');
  if (!b) return;
  e.stopPropagation();
  if (confirm(`Encerrar o OUTAGE ${b.dataset.hfcFim}? Ele sai da tela; as notas ficam guardadas.`)) encerrarHfc(b.dataset.hfcFim);
}, true);
