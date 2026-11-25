/* ══════════════════════════════════════════════════════════════
   RECs E RALs ASSOCIADAS ÀS RAL (link da coluna Ass.)
   - v61: o link também pode trazer RAL; elas entram na tela de RAL, na área
     certa, sem repetir (uma RAL que já está na lista não é somada de novo).
   - O seu coletor abre o link do número da coluna "Ass." de cada RAL
     e envia a lista dessas RECs (coluna "RECs Assoc." do CSV de RAL).
   - Aqui elas entram na tela de REC, na mesma área (CF) da RAL, e ficam
     agrupadas automaticamente como "VIDE RAL-xxxxx/aaaa".
   - Sem tickets repetidos: uma REC que já está na lista de REC não é
     somada de novo (só ganha o VIDE), e uma REC ligada a mais de uma RAL
     conta uma vez só (fica no VIDE da primeira RAL).
   - A cada atualização confere a quantidade da coluna "Ass." com as RECs
     lidas e mostra o resultado no rodapé.
   ══════════════════════════════════════════════════════════════ */

appState.recVide   = new Map();   /* identidade da REC → RAL de onde veio */
appState.assocInfo = null;
let _assocPrev = null;            /* REC → RAL da atualização anterior (para avisar mudanças) */

function mergeAssociatedRecs(ralRes, recRes) {
  const info = { rals: 0, esperado: 0, lidas: 0, adicionadas: 0, jaNaLista: 0, ralAdicionadas: 0, ralJaNaLista: 0, temLista: false, divergentes: [] };
  const existing = new Map();
  for (const p in (recRes.details || {}))
    for (const it of recRes.details[p]) { delete it.vide; existing.set(normTicket(it.ticket), it); }

  /* RAL que já estão na tela (inclusive as de Qualidade): não entram de novo */
  const ralExist = new Set();
  for (const p in (ralRes.details || {})) for (const it of ralRes.details[p]) ralExist.add(normTicket(it.ticket));
  for (const p in (ralRes.qualidadeDetails || {})) for (const it of ralRes.qualidadeDetails[p]) ralExist.add(normTicket(it.ticket));

  /* Área de cada associada: a da própria linha no link (se a página mostrar o CF),
     senão a mesma área da RAL de onde ela veio */
  const alvo = (r, p) => (r.cf && patternToCF[r.cf]) ? r.cf : p;

  /* As RAL com associadas (lista fixa antes de somar as novas) */
  const pais = [];
  for (const p in (ralRes.details || {}))
    for (const ral of ralRes.details[p])
      if (ral.ass || (ral.recs && ral.recs.length)) pais.push([p, ral]);

  const via = new Map();   /* ticket associado → RAL (1ª RAL que o trouxe) */
  for (const [p, ral] of pais) {
    info.rals++; info.esperado += ral.ass || 0;
    if (!Array.isArray(ral.recs)) continue;
    info.temLista = true;
    const nLidas = ral.recs.filter(r => normTicket(r.ticket) !== normTicket(ral.ticket)).length;
    info.lidas += nLidas;
    if (nLidas !== (ral.ass || 0))
      info.divergentes.push({ ral: ral.ticket, cf: ral.cfOrigem, ass: ral.ass || 0, lidas: nLidas });
    for (const r of ral.recs) {
      const key = normTicket(r.ticket);
      if (key === normTicket(ral.ticket) || via.has(key)) continue;   /* a própria RAL ou já veio por outra */
      via.set(key, ral.ticket);
      const tp = alvo(r, p);

      if (r.kind === 'ral') {
        /* RAL associada: vira cartão na tela de RAL, uma vez só */
        if (ralExist.has(key)) { info.ralJaNaLista++; continue; }
        if (/QUALIDADE/i.test(r.tipo || '')) continue;   /* Qualidade fica fora da contagem, como na lista principal */
        if (!ralRes.details[tp]) ralRes.details[tp] = [];
        ralRes.details[tp].push({
          ticket: r.ticket,
          designacao: r.designacao || 'N/D',
          extra: r.tipo || 'N/D',
          cfOrigem: patternToCF[tp],
          abertura: r.abertura || '',
          vide: ral.ticket,
          assoc: true,
        });
        ralRes.counts[tp] = (ralRes.counts[tp] || 0) + 1;
        ralRes.total = (ralRes.total || 0) + 1;
        ralExist.add(key);
        info.ralAdicionadas++;
        continue;
      }

      const cur = existing.get(key);
      if (cur) { cur.vide = ral.ticket; if (r.tipo && !cur.tipoRec) cur.tipoRec = r.tipo; info.jaNaLista++; continue; }
      if (!recRes.details[tp]) recRes.details[tp] = [];
      const item = {
        ticket: r.ticket,
        designacao: r.designacao || 'N/D',
        extra: r.cliente || 'N/D',
        cfOrigem: patternToCF[tp],
        abertura: r.abertura || '',
        vide: ral.ticket,
        tipoRec: r.tipo || '',
        assoc: true,
      };
      recRes.details[tp].push(item);
      recRes.counts[tp] = (recRes.counts[tp] || 0) + 1;
      recRes.total = (recRes.total || 0) + 1;
      existing.set(key, item);
      info.adicionadas++;
    }
  }

  /* Mudanças desde a última atualização (quantidade e quais RECs) */
  if (_assocPrev && info.temLista) {
    let mais = 0, menos = 0, mudou = 0;
    via.forEach((ral, rec) => { if (!_assocPrev.has(rec)) mais++; else if (_assocPrev.get(rec) !== ral) mudou++; });
    _assocPrev.forEach((ral, rec) => { if (!via.has(rec)) menos++; });
    info.mudancas = { mais, menos, mudou };
    if ((mais || menos || mudou) && typeof showActionToast === 'function') {
      const t = [mais ? `+${mais}` : '', menos ? `−${menos}` : '', mudou ? `${mudou} trocada${mudou > 1 ? 's' : ''} de RAL` : ''].filter(Boolean).join(' · ');
      showActionToast(`RECs associadas às RAL atualizadas: ${t}`, 'success');
    }
  }
  if (info.temLista) _assocPrev = via;
  appState.assocInfo = info;
  return info;
}

/* Depois de montar as listas: marca o VIDE de cada REC pela identidade da linha */
function buildRecVideMap() {
  const m = new Map();
  for (const tk of ['rec', 'ral'])
    for (const it of ((modalData[tk] && modalData[tk]['ALL']) || []))
      if (it.vide) m.set(makeIdentity(tk, it), it.vide);
  appState.recVide = m;
  renderAssocStatus();
}

/* Rodapé: conferência da quantidade (coluna Ass.) com as RECs lidas */
function renderAssocStatus() {
  const info = appState.assocInfo;
  let el = document.getElementById('assoc-status');
  if (!info || !info.rals) { if (el) el.remove(); return; }
  if (!el) {
    const footer = document.querySelector('.page-footer');
    if (!footer) return;
    el = document.createElement('span');
    el.id = 'assoc-status';
    footer.insertBefore(el, footer.lastElementChild);
  }
  let txt, cls, tip;
  if (!info.temLista) {
    txt = `Associadas em RAL: ${info.esperado} (sem lista)`;
    cls = 'warn';
    tip = 'A fonte em uso só informa a quantidade (coluna Ass.), sem dizer quais são as RECs. Elas só viram cartões nas áreas quando os dados vêm do seu coletor (versão w4 ou mais nova, que também lê as RAL do link).';
  } else {
    const ok = !info.divergentes.length;
    txt = `Associadas em RAL: ${info.lidas}/${info.esperado}${ok ? ' ✓' : ' ⚠'}`;
    cls = ok ? 'ok' : 'warn';
    tip = `${info.rals} RAL com RECs associadas · ${info.lidas} lidas de ${info.esperado} informadas na coluna Ass.\n` +
      `REC: ${info.adicionadas} somadas · ${info.jaNaLista} já estavam na lista (não repetidas)\n` +
      `RAL: ${info.ralAdicionadas} somadas · ${info.ralJaNaLista} já estavam na lista (não repetidas)` +
      (info.divergentes.length ? '\nQuantidade diferente em: ' + info.divergentes.slice(0, 8).map(d => `${d.ral} (${d.cf}) Ass. ${d.ass}, lidas ${d.lidas}`).join('; ') + (info.divergentes.length > 8 ? '…' : '') : '');
  }
  el.textContent = txt;
  el.className = 'assoc-status as-' + cls;
  el.title = tip;
}

/* A lista chegou com as associadas: o aviso de "ainda não contabiliza" não vale mais */
function _assocToast() {
  if (appState.assocInfo && appState.assocInfo.temLista && typeof dismissToast === 'function') { try { dismissToast(); } catch (e) {} }
}

/* VIDE automático: vale quando o ticket não tem um vínculo/evento feito à mão */
(function () {
  if (typeof evOf !== 'function') return;
  const manual = evOf;
  evOf = function (identity) {
    const e = manual(identity);
    if (e) return e;
    const ral = appState.recVide && appState.recVide.get(identity);
    if (!ral) return null;
    return { id: 'auto-' + normTicket(ral), n: `VIDE ${ral}`, k: 'vide', pt: ral, pi: '', auto: true };
  };
})();
