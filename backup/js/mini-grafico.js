/* ══════════════════════════════════════════════════════════════
   Gráfico dentro dos cards de área (v85 — redesenhado)
   Chave: "Gráfico dentro dos cards" (Configurações → Novidades).
   Estilo "card de ações": curvas suaves com área em degradê.
   - Mostra as ABERTURAS das últimas 24 horas, hora a hora, somando
     as últimas 3 horas em cada ponto (curva mais legível).
   - RAL: vermelho, linha mais grossa · REC: azul, linha mais fina
     (mesmas cores do mapa de calor).
   - Acima da curva: total de aberturas de RAL e REC em 24h.
   - Mesma escala em todos os cards, para comparar áreas.
   ══════════════════════════════════════════════════════════════ */
(function () {
  if (typeof SirUI === 'undefined') return;
  const ligado = () => typeof SirRecursos === 'undefined' || SirRecursos.ativo('mini');
  const N = 24, HORA = 3600000, JAN = 3, W = 200, H = 46, TOPO = 4, BASE = H - 1;

  /* aberturas por hora (24 pontos + 2 de folga para a soma móvel; o último é a hora atual) */
  function porHora(tk, cf, fim) {
    const v = new Array(N + JAN - 1).fill(0);
    const lista = (typeof modalData !== 'undefined' && modalData && modalData[tk] && modalData[tk][cf]) || [];
    for (const it of lista) {
      const t = typeof parseAbertura === 'function' ? parseAbertura(it.abertura) : 0;
      if (!t) continue;
      const k = Math.floor((fim - t) / HORA);
      if (k >= 0 && k < v.length) v[v.length - 1 - k]++;
    }
    return v;
  }
  /* soma móvel de 3h → curva legível; e total real das 24h */
  function serie(tk, cf, fim) {
    const v = porHora(tk, cf, fim), s = [];
    for (let i = JAN - 1; i < v.length; i++) { let a = 0; for (let j = 0; j < JAN; j++) a += v[i - j]; s.push(a); }
    return { s, total: v.slice(JAN - 1).reduce((a, b) => a + b, 0) };
  }

  /* Escala comum (pico do painel), recalculada quando o minuto ou os dados mudam */
  let escala = { k: '', max: 3 };
  function maxPainel(fim) {
    const k = Math.floor(Date.now() / 60000) + ':' + (((typeof modalData !== 'undefined' && modalData && modalData.ral && modalData.ral.ALL) || []).length) + ':' + (((typeof modalData !== 'undefined' && modalData && modalData.rec && modalData.rec.ALL) || []).length);
    if (escala.k === k) return escala.max;
    let m = 3;
    const cfs = typeof REGIONS !== 'undefined' ? Object.values(REGIONS).flatMap(o => Object.keys(o)) : [];
    for (const cf of cfs) m = Math.max(m, ...serie('ral', cf, fim).s, ...serie('rec', cf, fim).s);
    escala = { k, max: m };
    return m;
  }

  /* curva suave (Catmull-Rom → Bézier), sem passar abaixo da base nem acima do topo */
  function curva(s, max) {
    const p = s.map((n, i) => [i / (N - 1) * W, BASE - n / max * (BASE - TOPO)]);
    const c = y => Math.min(BASE, Math.max(TOPO, y));
    let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], e = p[i + 1], f = p[i + 2] || e;
      const c1 = [b[0] + (e[0] - a[0]) / 6, c(b[1] + (e[1] - a[1]) / 6)];
      const c2 = [e[0] - (f[0] - b[0]) / 6, c(e[1] - (f[1] - b[1]) / 6)];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
    }
    return d;
  }

  SirUI.miniGrafico = function (cf) {
    const fim = (Math.floor(Date.now() / HORA) + 1) * HORA;   /* blocos alinhados à hora cheia */
    const r = serie('ral', cf, fim), c = serie('rec', cf, fim);
    const max = maxPainel(fim);
    const id = 'mg' + String(cf).replace(/[^A-Za-z0-9]/g, '');
    const dR = curva(r.s, max), dC = curva(c.s, max);
    return `<div class="mini-box">
      <div class="mini-tot" aria-hidden="true"><span class="mt-ral">${r.total} RAL</span><span class="mt-rec">${c.total} REC</span><span class="mt-lbl">novas em 24h</span></div>
      <svg class="mini-graf" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
          aria-label="Aberturas nas últimas 24 horas em ${escapeHtml(cf)}: ${r.total} RAL e ${c.total} REC">
        <defs>
          <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mg-ral-s1"/><stop offset="1" class="mg-ral-s2"/></linearGradient>
          <linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="mg-rec-s1"/><stop offset="1" class="mg-rec-s2"/></linearGradient>
        </defs>
        <line class="mini-base" x1="0" x2="${W}" y1="${BASE}" y2="${BASE}"/>
        <path class="mini-area-rec" fill="url(#${id}c)" d="${dC} L${W} ${H} L0 ${H} Z"/>
        <path class="mini-area-ral" fill="url(#${id}r)" d="${dR} L${W} ${H} L0 ${H} Z"/>
        <path class="mini-rec" d="${dC}"/>
        <path class="mini-ral" d="${dR}"/>
      </svg>
    </div>`;
  };

  /* Desenho das curvas só no primeiro carregamento (não a cada atualização) */
  let intro = false;
  function marcaIntro() {
    if (intro) return; intro = true;
    document.documentElement.classList.add('mini-intro');
    setTimeout(() => document.documentElement.classList.remove('mini-intro'), 1600);
  }

  /* Card de CF: o gráfico entra entre o título e as células */
  const _card = SirUI.cardCF;
  SirUI.cardCF = function (p) {
    const html = _card(p);
    if (!ligado()) return html;
    marcaIntro();
    const g = SirUI.miniGrafico(p.cf);
    return html.replace('<div class="v2-tile-cells">', () => g + '\n    <div class="v2-tile-cells">');
  };

  /* Legenda no cabeçalho do grupo */
  const _grupo = SirUI.grupo;
  SirUI.grupo = function (p) {
    const html = _grupo(p);
    if (!ligado()) return html;
    const leg = `<span class="mini-legenda" title="Aberturas nas últimas 24 horas (soma de 3 em 3 horas)">
        <i class="ml-ral" aria-hidden="true"></i>RAL <i class="ml-rec" aria-hidden="true"></i>REC <span>· aberturas 24h</span></span>`;
    return html.replace(/(<span class="v2-region-count">[^<]*<\/span>)/, m => m + leg);
  };
})();
