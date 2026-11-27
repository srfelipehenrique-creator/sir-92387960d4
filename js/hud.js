/* ══════════════════════════════════════════════════════════════
   Visual HUD (v83) — linha de status e medidores de prazo.
   Só aparece com a chave "Visual HUD" ligada (css/rec-hud.css).
   - Linha de status no cabeçalho, "digitada" quando o texto muda:
     total em aberto, quantos vencem em menos de 30 min, quantos já
     passaram do prazo e entradas novas.
   - Medidores "no prazo agora": parte dos tickets abertos que ainda
     estão dentro do prazo (RAL 6h, REC 4h). Não é o Esert (que conta
     tickets encerrados) — é a situação dos abertos neste momento.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const reduz = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ligado = () => typeof SirRecursos === 'undefined' || SirRecursos.ativo('hud');

  function contas() {
    const r = { ral: { tot: 0, ok: 0, vence: 0, fora: 0 }, rec: { tot: 0, ok: 0, vence: 0, fora: 0 } };
    if (typeof modalData === 'undefined' || !modalData) return r;
    for (const tk of ['ral', 'rec']) {
      for (const it of (modalData[tk] && modalData[tk].ALL) || []) {
        const s = typeof calcSla === 'function' ? calcSla(it.abertura, tk === 'ral') : null;
        if (!s) continue;
        const c = r[tk]; c.tot++;
        if (s.remaining > 0) { c.ok++; if (s.remaining <= 30 * 60000) c.vence++; } else c.fora++;
      }
    }
    return r;
  }

  /* ── Linha de status: o urgente primeiro e em cor; digitada só na 1ª vez ── */
  let ultimo = '', digitando = 0, jaDigitou = false;
  function partes(c) {
    const novas = parseInt((document.getElementById('inbox-count') || {}).textContent, 10) || 0;
    const p = [], v = c.ral.vence + c.rec.vence, f = c.ral.fora + c.rec.fora;
    p.push(v ? { t: `${v} ${v > 1 ? 'vencem' : 'vence'} em menos de 30 min`, c: 'hs-warn' } : { t: 'nenhum vence nos próximos 30 min', c: 'hs-base' });
    if (f) p.push({ t: `${f} fora do prazo`, c: 'hs-crit' });
    if (novas) p.push({ t: `${novas} ${novas > 1 ? 'entradas novas' : 'entrada nova'}`, c: '' });
    p.push({ t: `${c.ral.tot} RAL · ${c.rec.tot} REC em aberto`, c: 'hs-base' });
    return p;
  }
  const html = p => p.map(x => `<span class="${x.c}">${x.t}</span>`).join('<span class="hs-base"> · </span>');
  function escreve(el, p) {
    const txt = p.map(x => x.t).join(' · ');
    el.querySelector('.sr-only').textContent = txt;      /* o leitor de tela lê só o texto final */
    const vis = el.querySelector('.hs-vis');
    clearInterval(digitando);
    if (jaDigitou || reduz()) { vis.innerHTML = html(p); return; }
    jaDigitou = true;
    let i = 0;
    vis.innerHTML = '<span></span><i class="hud-caret"></i>';
    const alvo = vis.firstChild;
    digitando = setInterval(() => {
      i += 2; alvo.textContent = txt.slice(0, i);
      if (i >= txt.length) { clearInterval(digitando); vis.innerHTML = html(p); }
    }, 16);
  }
  function status(c) {
    let el = document.getElementById('hud-status');
    if (!el) {
      const bar = document.querySelector('header .app-bar');
      const ref = document.getElementById('hdr-scope');
      if (!bar) return;
      el = document.createElement('div');
      el.id = 'hud-status'; el.className = 'hud-status';
      el.innerHTML = '<span class="hs-vis" aria-hidden="true"></span><span class="sr-only" role="status"></span>';
      bar.insertBefore(el, ref ? ref.nextSibling : null);
    }
    const p = partes(c), k = p.map(x => x.t).join('|');
    if (k !== ultimo) { ultimo = k; escreve(el, p); }
  }

  /* ── Área que acabou de ficar crítica: pulsa 3 vezes (uma vez só) ── */
  let criticas = null;
  function pulsoCriticas() {
    const agora = new Set();
    document.querySelectorAll('#main-grid .v2-tile').forEach(t => { if (t.querySelector('.v2-cell.v2-crit')) agora.add(t.dataset.cf); });
    agora.forEach(cf => {
      if (criticas && criticas.has(cf)) return;
      const t = document.querySelector(`#main-grid .v2-tile[data-cf="${CSS.escape(cf)}"]`);
      if (!t) return;
      t.classList.add('hud-crit-novo');
      setTimeout(() => t.classList.remove('hud-crit-novo'), 4500);
    });
    criticas = agora;
  }

  /* ── Medidores ── */
  function medidor(nome, prazo, c) {
    const pct = c.tot ? Math.round(c.ok / c.tot * 100) : 0, L = 163.36;
    const cor = pct >= 90 ? 'var(--v2-ok)' : pct >= 60 ? 'var(--v2-warn)' : 'var(--v2-crit)';
    return `<div class="hud-gauge" role="img" aria-label="${nome} no prazo agora: ${pct}% (${c.ok} de ${c.tot})">
      <svg width="60" height="60" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="26" fill="none" stroke="var(--hud-line)" stroke-width="6"/>
        <circle class="hg-arc" cx="32" cy="32" r="26" fill="none" stroke="${cor}" stroke-width="6" stroke-linecap="round"
          transform="rotate(-90 32 32)" stroke-dasharray="${L}" stroke-dashoffset="${L}" data-to="${(L * (1 - pct / 100)).toFixed(1)}"/>
        <text class="hg-v" x="32" y="38" text-anchor="middle">${pct}%</text>
      </svg>
      <span class="hg-t"><b>${nome} no prazo</b>${c.ok} de ${c.tot} · prazo ${prazo}</span>
    </div>`;
  }
  function prazo(c) {
    const inbox = document.getElementById('inbox-section');
    if (!inbox) return;
    let box = document.getElementById('hud-prazo');
    const novo = !box;
    if (novo) {
      box = document.createElement('div');
      box.id = 'hud-prazo'; box.className = 'hud-prazo';
      inbox.insertBefore(box, inbox.firstChild);
    }
    box.innerHTML = medidor('RAL', '6h', c.ral) + medidor('REC', '4h', c.rec);
    /* desenha o arco (anima só na 1ª vez; depois, ajusta em silêncio) */
    const arcs = box.querySelectorAll('.hg-arc');
    const fim = () => arcs.forEach(a => a.setAttribute('stroke-dashoffset', a.dataset.to));
    if (novo && !reduz()) requestAnimationFrame(() => requestAnimationFrame(fim));
    else { arcs.forEach(a => a.style.transition = 'none'); fim(); }
  }

  /* ── Animações da tela HUD 1 ── */
  /* arco girando ao lado do "SIR" (o "radar" do assistente) */
  function logo() {
    const t = document.querySelector('.app-bar-title');
    if (!t || document.getElementById('hud-logo')) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.id = 'hud-logo'; s.setAttribute('class', 'hud-logo'); s.setAttribute('viewBox', '0 0 38 38'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<circle cx="19" cy="19" r="15" class="hl-ring"/><g class="hl-spin"><path d="M19 4 A15 15 0 0 1 34 19" class="hl-arc"/></g><g class="hl-spin2"><path d="M19 30 A11 11 0 0 1 8 19" class="hl-arc2"/></g><circle cx="19" cy="19" r="3.5" class="hl-dot"/>';
    t.parentNode.insertBefore(s, t);
  }
  /* logo gira 1 volta quando chegam dados */
  function giraLogo() {
    const l = document.getElementById('hud-logo'); if (!l || reduz()) return;
    l.classList.remove('ativo'); void l.getBoundingClientRect(); l.classList.add('ativo');
    clearTimeout(l._t); l._t = setTimeout(() => l.classList.remove('ativo'), 2000);
  }
  /* varredura de luz: ao abrir o painel e quando ENTRA ticket novo (total em aberto sobe ou chega
     entrada nova) — nunca em troca de filtro nem em atualização sem novidade */
  let ultimoTotal = null, ultimasNovas = 0;
  function talvezVarrer(c) {
    const tot = c.ral.tot + c.rec.tot;
    const novas = parseInt((document.getElementById('inbox-count') || {}).textContent, 10) || 0;
    const primeira = ultimoTotal === null, subiu = !primeira && (tot > ultimoTotal || novas > ultimasNovas);
    ultimoTotal = tot; ultimasNovas = novas;
    if (primeira || subiu) { varredura(); giraLogo(); }
  }
  function varredura() {
    if (reduz()) return;
    let v = document.getElementById('hud-scan');
    if (!v) { v = document.createElement('div'); v.id = 'hud-scan'; v.className = 'hud-scan'; v.setAttribute('aria-hidden', 'true'); document.body.appendChild(v); }
    v.classList.remove('on'); void v.offsetWidth; v.classList.add('on');
  }

  function atualiza() {
    if (!ligado()) return;
    try { logo(); } catch (e) {}
    try { const c = contas(); status(c); prazo(c); talvezVarrer(c); } catch (e) { console.warn('hud', e); }
    try { pulsoCriticas(); } catch (e) {}
  }

  if (typeof renderDashboardV2 === 'function') {
    const _orig = renderDashboardV2;
    renderDashboardV2 = function () { const r = _orig.apply(this, arguments); atualiza(); return r; };
  }
  /* prazos andam com o relógio: recalcula a cada minuto */
  setInterval(() => { if (!document.hidden) atualiza(); }, 60000);
  document.addEventListener('sir-recursos', e => { if (e.detail.id === 'hud') { ultimo = ''; jaDigitou = false; atualiza(); } });
})();
