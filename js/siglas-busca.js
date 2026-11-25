/* ══════════════════════════════════════════════════════════════
   v69 — Busca de siglas (lógica pura, sem tela)
   Usada pelo trabalhador em segundo plano (js/siglas-worker.js) e,
   se o aparelho não tiver esse recurso, pela própria página.
   Mesmas regras de antes: "ARS RP", "ARSRP" e "ars-rp" acham a
   mesma sigla; com 3+ letras também procura no endereço, prédio e
   empresa.
   data/siglas.json: { cols:[sigla, endereco, uf, tipo, nomeFantasia, razaoSocial, predio], dic:{uf,tipo,ng,rs,pr}, rows }
   ══════════════════════════════════════════════════════════════ */
var SiglasBusca = (function () {
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const compact = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  let rows = null, dic = null, idx = null;

  function carregar(json) { rows = json.rows; dic = json.dic; idx = null; }
  function pronto() { return !!rows; }
  function total() { return rows ? rows.length : 0; }
  function item(i) {
    const r = rows[i];
    return { sigla: r[0], end: r[1], uf: dic.uf[r[2]], tipo: dic.tipo[r[3]], fantasia: dic.ng[r[4]], razao: dic.rs[r[5]], predio: dic.pr[r[6]] };
  }
  function indice() {
    if (!idx) idx = rows.map(r => ({ c: compact(r[0]), n: norm(r[0]),
      a: norm([r[0], r[1], dic.ng[r[4]], dic.rs[r[5]], dic.pr[r[6]]].join(' ')) }));
    return idx;
  }
  /* → { exact, starts, has, text }: listas de posições, da mais parecida para a menos */
  function buscar(q) {
    const out = { exact: [], starts: [], has: [], text: [] };
    if (!rows) return out;
    const qn = norm(q), qc = compact(q);
    if (!qn) return out;
    indice().forEach((x, i) => {
      if (qc && x.c === qc) out.exact.push(i);
      else if (qc && x.c && x.c.startsWith(qc)) out.starts.push(i);
      else if (qc && x.c && x.c.includes(qc)) out.has.push(i);
      else if (qn.length >= 3 && x.a.includes(qn)) out.text.push(i);
    });
    const by = (a, b) => idx[a].n.localeCompare(idx[b].n);
    out.starts.sort(by); out.has.sort(by); out.text.sort(by);
    return out;
  }
  return { carregar, pronto, total, item, indice, buscar };
})();
