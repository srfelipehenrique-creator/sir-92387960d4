/* ══════════════════════════════════════════════════════════════
   v69 — Componente: Card de CF (ex.: "MTN · Metropolitana Norte")
   Título que abre/fecha o resumo, botão de copiar, células
   RAL / REC / QUAL e o resumo por classificação.
   props: {
     cf, nome, minha, aberto, resumoHTML,
     ral: { valor, delta, titulo },
     rec: { valor, delta, titulo },
     qual: { valor, chave, titulo }
   }
   ══════════════════════════════════════════════════════════════ */
SirUI.cardCF = function ({ cf, nome = '', minha = false, aberto = false, resumoHTML = '', ral, rec, qual }) {
  const c = escapeHtml(cf);
  return `<div class="v2-tile v2-exp${minha ? ' v2-mine' : ''}${aberto ? ' v2-open' : ''}" data-v2card data-cf="${c}" data-key="cf:${c}">
    <div class="v2-card-top">
      <button type="button" class="v2-tile-head" data-v2toggle aria-expanded="${aberto}" title="Toque para ${aberto ? 'fechar' : 'ver'} o resumo por classificação">
        <span class="v2-tile-cf">${c}</span>
        <span class="v2-tile-name">${escapeHtml(nome)}</span>
        <i class="v2-chev" aria-hidden="true"></i>
      </button>
      ${SirUI.botaoCopiar()}
    </div>
    <div class="v2-tile-cells">
      ${SirUI.celula({ tipo: 'ral', cf, ...ral })}
      ${SirUI.celula({ tipo: 'rec', cf, ...rec })}
      ${SirUI.celulaQual({ cf, ...qual })}
    </div>
    <div class="v2-sum"${aberto ? '' : ' hidden'}>${aberto ? resumoHTML : ''}</div>
  </div>`;
};
