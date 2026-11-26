/* ══════════════════════════════════════════════════════════════
   Gráfico dentro dos cards de área (v83)
   Chave: "Gráfico dentro dos cards" (Configurações → Novidades).
   - Em cada card de CF, um minigráfico das ABERTURAS nas últimas
     24 horas, em blocos de 2 horas (o último bloco termina agora).
   - RAL: linha cheia âmbar com área preenchida.
     REC: linha tracejada ciano (diferença por cor E por traço).
   - Legenda uma vez no cabeçalho de cada grupo.
   ══════════════════════════════════════════════════════════════ */
(function () {
  if (typeof SirUI === 'undefined') return;
  const ligado = () => typeof SirRecursos === 'undefined' || SirRecursos.ativo('mini');
  const BLOCOS = 12, PASSO = 2 * 3600000, W = 120, H = 34;

  function serie(tk, cf, agora) {
    const v = new Array(BLOCOS).fill(0);
    const lista = (typeof modalData !== 'undefined' && modalData && modalData[tk] && modalData[tk][cf]) || [];
    for (const it of lista) {
      const t = typeof parseAbertura === 'function' ? parseAbertura(it.abertura) : 0;
      if (!t) continue;
      const k = Math.floor((agora - t) / PASSO);
      if (k >= 0 && k < BLOCOS) v[BLOCOS - 1 - k]++;
    }
    return v;
  }
  function pontos(v, max) {
    return v.map((n, i) => `${(i / (BLOCOS - 1) * W).toFixed(1)},${(H - 2 - n / max * (H - 6)).toFixed(1)}`).join(' ');
  }

  /* Mesma escala em todos os cards (pico do painel inteiro), recalculada a cada minuto */
  let escala = { k: -1, max: 2 };
  function maxPainel(agora) {
    const k = Math.floor(Date.now() / 60000) + ':' + ((typeof modalData !== 'undefined' && modalData && modalData.ral && modalData.ral.ALL) || []).length;
    if (escala.k === k) return escala.max;
    let m = 2;
    const cfs = typeof REGIONS !== 'undefined' ? Object.values(REGIONS).flatMap(o => Object.keys(o)) : [];
    for (const cf of cfs) m = Math.max(m, ...serie('ral', cf, agora), ...serie('rec', cf, agora));
    escala = { k, max: m };
    return m;
  }

  SirUI.miniGrafico = function (cf) {
    const agora = Math.floor(Date.now() / 3600000) * 3600000 + 3600000;   /* blocos alinhados às horas cheias */
    const ral = serie('ral', cf, agora), rec = serie('rec', cf, agora);
    const tR = ral.reduce((a, b) => a + b, 0), tC = rec.reduce((a, b) => a + b, 0);
    const max = maxPainel(agora), pico = Math.max(...ral, ...rec);
    const pR = pontos(ral, max), pC = pontos(rec, max);
    return `<svg class="mini-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
        aria-label="Aberturas nas últimas 24 horas em ${escapeHtml(cf)}: ${tR} RAL e ${tC} REC, pico de ${pico} em 2 horas">
      <polygon class="mini-area" points="0,${H} ${pR} ${W},${H}"/>
      <polyline class="mini-ral" points="${pR}"/>
      <polyline class="mini-rec" points="${pC}"/>
    </svg>`;
  };

  /* Card de CF: o gráfico entra entre o título e as células */
  const _card = SirUI.cardCF;
  SirUI.cardCF = function (p) {
    const html = _card(p);
    if (!ligado()) return html;
    const g = SirUI.miniGrafico(p.cf);
    return html.replace('<div class="v2-tile-cells">', () => g + '\n    <div class="v2-tile-cells">');
  };

  /* Legenda no cabeçalho do grupo */
  const _grupo = SirUI.grupo;
  SirUI.grupo = function (p) {
    const html = _grupo(p);
    if (!ligado()) return html;
    const leg = `<span class="mini-legenda" title="Aberturas nas últimas 24 horas, em blocos de 2 horas">
        <i class="ml-ral" aria-hidden="true"></i>RAL <i class="ml-rec" aria-hidden="true"></i>REC <span>· aberturas 24h</span></span>`;
    return html.replace(/(<span class="v2-region-count">[^<]*<\/span>)/, m => m + leg);
  };
})();
