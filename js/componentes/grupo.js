/* ══════════════════════════════════════════════════════════════
   v69 — Componente: Grupo de áreas (ES, Interior, Capital)
   Cabeçalho com nome e quantidade de CFs, cards dos CFs e,
   opcionalmente, o botão e a área dos gráficos do grupo.
   props: { nome, qtdCFs, cardsHTML, botaoGraficoHTML, graficosHTML }
   ══════════════════════════════════════════════════════════════ */
SirUI.grupo = function ({ nome, qtdCFs, cardsHTML, botaoGraficoHTML = '', graficosHTML = '' }) {
  const n = escapeHtml(nome);
  return `<section class="v2-region" data-region="${n}" data-key="reg:${n}">
      <div class="v2-region-head">
        <span class="v2-region-name">${n}</span>
        <span class="v2-region-count">${qtdCFs} CF${qtdCFs > 1 ? 's' : ''}</span>
        ${botaoGraficoHTML}
      </div>
      <div class="v2-region-body">
        <div class="v2-tiles">${cardsHTML}</div>
        ${graficosHTML}
      </div>
    </section>`;
};
