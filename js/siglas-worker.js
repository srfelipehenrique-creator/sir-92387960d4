/* ══════════════════════════════════════════════════════════════
   v69 — Trabalhador em segundo plano das siglas (Web Worker)
   Baixa e lê o arquivo de ~11 MB, monta o índice e faz as buscas
   fora da tela principal → a janela ENDEREÇOS não trava, nem no
   celular. Só devolve à tela os itens que ela vai mostrar.
   Mensagens:
     { tipo:'carregar', url }            → { tipo:'pronto', total } | { tipo:'erro' }
     { tipo:'buscar', id, q, limite }    → { tipo:'resultado', id, res, itens }
   ══════════════════════════════════════════════════════════════ */
importScripts('siglas-busca.js');

let carregando = null;

self.onmessage = async e => {
  const m = e.data || {};
  if (m.tipo === 'carregar') {
    try {
      if (!SiglasBusca.pronto()) {
        if (!carregando) carregando = fetch(m.url).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
        SiglasBusca.carregar(await carregando);
        SiglasBusca.indice();                         /* índice pronto antes da primeira busca */
      }
      self.postMessage({ tipo: 'pronto', total: SiglasBusca.total() });
    } catch (err) {
      carregando = null;
      self.postMessage({ tipo: 'erro', msg: String(err && err.message || err) });
    }
    return;
  }
  if (m.tipo === 'buscar') {
    const res = SiglasBusca.buscar(m.q);
    const lim = m.limite || 60, itens = {};
    for (const t of ['exact', 'starts', 'has', 'text']) res[t].slice(0, lim).forEach(i => { itens[i] = SiglasBusca.item(i); });
    self.postMessage({ tipo: 'resultado', id: m.id, res, itens });
  }
};
