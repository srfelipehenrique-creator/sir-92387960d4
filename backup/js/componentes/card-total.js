/* ══════════════════════════════════════════════════════════════
   v69 — Componente: Card de total (Total RRE, Minhas áreas, ES,
   Interior, Capital). Só o de "Minhas áreas" abre o resumo.
   props: {
     rotulo, chave, destaque, expansivel, aberto, resumoHTML, idCard,
     ral: { valor, titulo }, rec: { valor, titulo },
     qual: { valor, chave, titulo }
   }
   ══════════════════════════════════════════════════════════════ */
SirUI.cardTotal = function ({ rotulo, chave, destaque = false, expansivel = false, aberto = false, resumoHTML = '', idCard = '', ral, rec, qual }) {
  const r = escapeHtml(rotulo);
  aberto = expansivel && aberto;
  const head = expansivel
    ? `<div class="v2-card-top">
         <button type="button" class="v2-kpi-lbl v2-kpi-toggle" data-v2toggle aria-expanded="${aberto}" title="Toque para ${aberto ? 'fechar' : 'ver'} o resumo por classificação">${r}<i class="v2-chev" aria-hidden="true"></i></button>
         ${SirUI.botaoCopiar()}
       </div>`
    : `<div class="v2-kpi-lbl">${r}</div>`;
  const botao = (tipo, isRal, d) => `<button class="v2-kpi-btn v2-t-${SirUI.sevTotal(d.valor)}" onclick="${SirUI.abrirLista(chave, isRal, d.titulo)}" aria-label="${tipo} ${r}: ${d.valor}">
        <span class="v2-kpi-type">${tipo}</span><span class="animate-num" data-val="${d.valor}">${d.valor}</span>
      </button>`;
  return `<div class="v2-kpi${destaque ? ' v2-kpi-accent' : ''}${expansivel ? ' v2-exp' : ''}${aberto ? ' v2-open' : ''}"${expansivel ? ` data-v2card data-cf="${idCard}"` : ''} data-key="kpi:${escapeHtml(chave)}">
    ${head}
    <div class="v2-kpi-vals">
      ${botao('RAL', true, ral)}
      ${botao('REC', false, rec)}
      <button class="v2-kpi-btn v2-kpi-qual" onclick="${SirUI.abrirLista(qual.chave, true, qual.titulo)}" title="RALs de Qualidade" aria-label="RAL de Qualidade ${r}: ${qual.valor}">
        <span class="v2-kpi-type">QUALID.</span><span class="animate-num" data-val="${qual.valor}">${qual.valor}</span>
      </button>
    </div>
    ${expansivel ? `<div class="v2-sum"${aberto ? '' : ' hidden'}>${aberto ? resumoHTML : ''}</div>` : ''}
  </div>`;
};
