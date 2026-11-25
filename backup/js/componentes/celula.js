/* ══════════════════════════════════════════════════════════════
   v69 — Componentes do painel (boa prática do React Native)
   Cada peça da tela é uma função pequena que recebe só os dados de
   que precisa ("props") e devolve o HTML. Não lê nada global além
   de escapeHtml → dá para mudar uma peça sem quebrar as outras.

   Este arquivo: utilitários comuns + Célula (RAL / REC / QUAL).
   Outros: card-cf.js · card-total.js · grupo.js
   ══════════════════════════════════════════════════════════════ */
const SirUI = window.SirUI || {};
window.SirUI = SirUI;

/* Texto seguro dentro de onclick="...('texto')" */
SirUI.js = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
SirUI.plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* Cor pela quantidade */
SirUI.sevCF = v => v >= 10 ? 'crit' : v >= 6 ? 'warn' : v >= 1 ? 'ok' : 'zero';   /* card de CF */
SirUI.sevTotal = v => v > 49 ? 'crit' : v > 29 ? 'warn' : 'ok';                    /* cards de total */

/* Ação de abrir a lista de tickets */
SirUI.abrirLista = (chave, isRal, titulo) => `openModal('${SirUI.js(chave)}',${isRal},'${SirUI.js(titulo)}')`;

/* Botão de copiar o resumo (aparece nos cards abertos) */
SirUI.botaoCopiar = () => `<button type="button" class="v2-sum-copy" data-v2copy title="Copiar resumo para enviar por mensagem" aria-label="Copiar resumo">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  </button>`;

/* ── Célula RAL / REC de um CF ──
   props: { tipo: 'ral'|'rec', cf, valor, delta, titulo } */
SirUI.celula = function ({ tipo, cf, valor, delta = 0, titulo }) {
  const isRal = tipo === 'ral', T = isRal ? 'RAL' : 'REC', c = escapeHtml(cf);
  return `<button class="v2-cell v2-${SirUI.sevCF(valor)}" onclick="${SirUI.abrirLista(cf, isRal, titulo)}"
            title="${T} ${c}" aria-label="${T} ${c}: ${SirUI.plural(valor, 'ticket', 'tickets')}${delta > 0 ? `, mais ${delta} desde a última atualização` : ''}">
    <span class="v2-cell-lbl">${T}</span>
    <span class="v2-cell-val animate-num" data-val="${valor}">${valor}</span>
    ${delta > 0 ? `<span class="v2-delta" title="Aumento desde a última atualização">+${delta}</span>` : ''}
  </button>`;
};

/* ── Célula QUAL (RAL de Qualidade) de um CF ──
   props: { cf, valor, chave, titulo } */
SirUI.celulaQual = function ({ cf, valor, chave, titulo }) {
  const c = escapeHtml(cf);
  return `<button class="v2-cell v2-qual${valor ? '' : ' v2-zero'}" onclick="${SirUI.abrirLista(chave, true, titulo)}"
            title="RAL de Qualidade ${c}" aria-label="RAL de Qualidade ${c}: ${SirUI.plural(valor, 'ticket', 'tickets')}">
    <span class="v2-cell-lbl">QUAL</span>
    <span class="v2-cell-val animate-num" data-val="${valor}">${valor}</span>
  </button>`;
};
