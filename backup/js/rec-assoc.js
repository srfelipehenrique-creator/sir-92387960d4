/* ══════════════════════════════════════════════════════════════
   RECs E RALs ASSOCIADAS ÀS RAL (link da coluna Ass.)
   - v100: unifica associadas vindas tanto de RALs dos CFs quanto de
     RALs em DP; cria cards reais com todas as informações e grava
     sempre o ticket mãe (`ralMae` e `vide`) em ambos os dashboards.
   - Sem duplicidade: ticket que já está na tela não é contado 2x
     (apenas recebe o selo do ticket mãe e o VIDE).
   - Se sair da tela/associação no 2º dashboard, sai imediatamente do
     1º dashboard na próxima atualização.
   ══════════════════════════════════════════════════════════════ */

appState.recVide       = new Map();   /* identidade → ticket mãe */
appState.assocInfo     = null;
appState.assocByParent = new Map();   /* normTicket(ralMae) → lista de associadas */
let _assocPrev = null;

function _normCFPattern(s) {
  return String(s || '').toUpperCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
}

function mergeAssociatedRecs(ralRes, recRes) {
  const info = { rals: 0, esperado: 0, lidas: 0, adicionadas: 0, jaNaLista: 0, ralAdicionadas: 0, ralJaNaLista: 0, temLista: false, divergentes: [] };
  const normToPattern = {};
  for (const p of Object.keys(patternToCF)) normToPattern[_normCFPattern(p)] = p;

  const existingRec = new Map();
  for (const p in (recRes.details || {}))
    for (const it of recRes.details[p]) {
      delete it.vide; delete it.ralMae;
      existingRec.set(normTicket(it.ticket), it);
    }

  /* RALs que já estão na tela (inclusive Qualidade): não entram repetidas, mas ganham ticket mãe */
  const existingRal = new Map();
  for (const p in (ralRes.details || {}))
    for (const it of ralRes.details[p]) {
      delete it.vide; delete it.ralMae;
      existingRal.set(normTicket(it.ticket), it);
    }
  const qualExist = new Set();
  for (const p in (ralRes.qualidadeDetails || {}))
    for (const it of ralRes.qualidadeDetails[p]) qualExist.add(normTicket(it.ticket));

  const dpRecExist = new Map();
  for (const it of (recRes.dpDetails || [])) { delete it.vide; delete it.ralMae; dpRecExist.set(normTicket(it.ticket), it); }
  const dpRalExist = new Map();
  for (const it of (ralRes.dpDetails || [])) { delete it.vide; delete it.ralMae; dpRalExist.set(normTicket(it.ticket), it); }

  /* Resolve CF de destino de uma associada (DP fica em DP; CF da própria linha → CF do pai se for do painel) */
  const alvoPattern = (r, parentPattern) => {
    if (r.cf) {
      const norm = _normCFPattern(r.cf);
      if (norm.startsWith('DP/')) return null;
      if (patternToCF[r.cf]) return r.cf;
      const byNorm = normToPattern[norm];
      if (byNorm) return byNorm;
    }
    return (parentPattern && patternToCF[parentPattern]) ? parentPattern : null;
  };

  /* Lista fixa de RALs-mãe (CFs do painel + RALs em DP) antes de inserir as associadas */
  const pais = [];
  for (const p in (ralRes.details || {}))
    for (const ral of ralRes.details[p])
      if (ral.ass || (ral.recs && ral.recs.length)) pais.push([p, ral]);
  for (const ral of (ralRes.dpDetails || []))
    if (ral.ass || (ral.recs && ral.recs.length)) pais.push([null, ral]);

  const via = new Map();            /* ticket associado → ticket mãe */
  const byParent = new Map();       /* normTicket(ralMae) → lista limpa de associadas */

  for (const [p, ral] of pais) {
    const ralKey = normTicket(ral.ticket);
    info.rals++; info.esperado += ral.ass || 0;
    if (!Array.isArray(ral.recs)) continue;
    info.temLista = true;
    const validas = ral.recs.filter(r => normTicket(r.ticket) !== ralKey);
    byParent.set(ralKey, validas);
    const nLidas = validas.length;
    info.lidas += nLidas;
    if (nLidas !== (ral.ass || 0))
      info.divergentes.push({ ral: ral.ticket, cf: ral.cfOrigem, ass: ral.ass || 0, lidas: nLidas });

    for (const r of validas) {
      const key = normTicket(r.ticket);
      if (via.has(key)) continue;   /* já vinculada a outra RAL-mãe */
      via.set(key, ral.ticket);
      const tp = alvoPattern(r, p);

      if (r.kind === 'ral') {
        if (qualExist.has(key) || /QUALIDADE/i.test(r.tipo || '')) continue;
        const curRal = existingRal.get(key);
        if (curRal) {
          curRal.vide = ral.ticket; curRal.ralMae = ral.ticket;
          info.ralJaNaLista++;
          continue;
        }
        const curDpRal = dpRalExist.get(key);
        if (curDpRal) {
          curDpRal.vide = ral.ticket; curDpRal.ralMae = ral.ticket;
          continue;
        }
        if (tp) {
          if (!ralRes.details[tp]) ralRes.details[tp] = [];
          const item = {
            ticket: r.ticket,
            designacao: r.designacao || 'N/D',
            extra: r.tipo || 'N/D',
            cfOrigem: patternToCF[tp],
            cfRaw: r.cf || tp,
            abertura: r.abertura || '',
            vide: ral.ticket,
            ralMae: ral.ticket,
            assoc: true,
          };
          ralRes.details[tp].push(item);
          ralRes.counts[tp] = (ralRes.counts[tp] || 0) + 1;
          ralRes.total = (ralRes.total || 0) + 1;
          existingRal.set(key, item);
          info.ralAdicionadas++;
        } else if (_normCFPattern(r.cf || ral.cfRaw).startsWith('DP/')) {
          const item = {
            ticket: r.ticket, designacao: r.designacao || 'N/D', extra: r.tipo || 'N/D',
            cfOrigem: 'DP', cfRaw: r.cf || ral.cfRaw || 'DP/RJO', abertura: r.abertura || '',
            vide: ral.ticket, ralMae: ral.ticket, assoc: true,
          };
          ralRes.dpDetails = ralRes.dpDetails || [];
          ralRes.dpDetails.push(item);
          dpRalExist.set(key, item);
        }
        continue;
      }

      /* REC associada */
      const curRec = existingRec.get(key);
      if (curRec) {
        curRec.vide = ral.ticket; curRec.ralMae = ral.ticket;
        if (r.tipo && !curRec.tipoRec) curRec.tipoRec = r.tipo;
        info.jaNaLista++;
        continue;
      }
      const curDpRec = dpRecExist.get(key);
      if (curDpRec) {
        curDpRec.vide = ral.ticket; curDpRec.ralMae = ral.ticket;
        if (r.tipo && !curDpRec.tipoRec) curDpRec.tipoRec = r.tipo;
        continue;
      }
      if (tp) {
        if (!recRes.details[tp]) recRes.details[tp] = [];
        const item = {
          ticket: r.ticket,
          designacao: r.designacao || 'N/D',
          extra: r.cliente || 'N/D',
          cfOrigem: patternToCF[tp],
          cfRaw: r.cf || tp,
          abertura: r.abertura || '',
          vide: ral.ticket,
          ralMae: ral.ticket,
          tipoRec: r.tipo || '',
          assoc: true,
        };
        recRes.details[tp].push(item);
        recRes.counts[tp] = (recRes.counts[tp] || 0) + 1;
        recRes.total = (recRes.total || 0) + 1;
        existingRec.set(key, item);
        info.adicionadas++;
      } else if (_normCFPattern(r.cf || ral.cfRaw).startsWith('DP/')) {
        const item = {
          ticket: r.ticket, designacao: r.designacao || 'N/D', extra: r.cliente || 'N/D',
          cfOrigem: 'DP', cfRaw: r.cf || ral.cfRaw || 'DP/RJO', abertura: r.abertura || '',
          vide: ral.ticket, ralMae: ral.ticket, tipoRec: r.tipo || '', assoc: true,
        };
        recRes.dpDetails = recRes.dpDetails || [];
        recRes.dpDetails.push(item);
        dpRecExist.set(key, item);
      }
    }
  }

  /* Mudanças desde a última atualização (entradas, saídas e trocas de RAL mãe) */
  if (_assocPrev && info.temLista) {
    let mais = 0, menos = 0, mudou = 0;
    via.forEach((ral, rec) => { if (!_assocPrev.has(rec)) mais++; else if (_assocPrev.get(rec) !== ral) mudou++; });
    _assocPrev.forEach((ral, rec) => { if (!via.has(rec)) menos++; });
    info.mudancas = { mais, menos, mudou };
    if ((mais || menos || mudou) && typeof showActionToast === 'function') {
      const t = [mais ? `+${mais}` : '', menos ? `−${menos}` : '', mudou ? `${mudou} trocada${mudou > 1 ? 's' : ''} de RAL` : ''].filter(Boolean).join(' · ');
      showActionToast(`Associadas atualizadas nos 2 painéis: ${t}`, 'success');
    }
  }
  if (info.temLista) _assocPrev = via;
  appState.assocByParent = byParent;
  appState.assocInfo = info;
  return info;
}

/* Depois de montar as listas: marca o VIDE / ticket mãe pela identidade da linha */
function buildRecVideMap() {
  const m = new Map();
  for (const tk of ['rec', 'ral'])
    for (const it of ((modalData[tk] && modalData[tk]['ALL']) || []))
      if (it.vide || it.ralMae) m.set(makeIdentity(tk, it), it.ralMae || it.vide);
  appState.recVide = m;
  renderAssocStatus();
}

/* Rodapé: conferência da quantidade (coluna Ass.) com as associadas lidas */
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
    tip = 'A fonte em uso só informa a quantidade (coluna Ass.), sem listar os números. Ligue o Coletor SIR (w9) para contabilizar os tickets reais com ticket mãe nos dois dashboards.';
  } else {
    const ok = !info.divergentes.length;
    txt = `Associadas em RAL: ${info.lidas}/${info.esperado}${ok ? ' ✓' : ' ⚠'}`;
    cls = ok ? 'ok' : 'warn';
    tip = `${info.rals} RAL com associadas · ${info.lidas} lidas de ${info.esperado} informadas na coluna Ass.\n` +
      `REC: ${info.adicionadas} somadas · ${info.jaNaLista} já estavam na lista (não repetidas)\n` +
      `RAL: ${info.ralAdicionadas} somadas · ${info.ralJaNaLista} já estavam na lista (não repetidas)` +
      (info.divergentes.length ? '\nQuantidade diferente em: ' + info.divergentes.slice(0, 8).map(d => `${d.ral} (${d.cf}) Ass. ${d.ass}, lidas ${d.lidas}`).join('; ') + (info.divergentes.length > 8 ? '…' : '') : '');
  }
  el.textContent = txt;
  el.className = 'assoc-status as-' + cls;
  el.title = tip;
}

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
