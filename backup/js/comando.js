/* ══════════════════════════════════════════════════════════════
   Busca rápida — Ctrl K (v83)
   Chave: "Busca rápida (Ctrl K)" (Configurações → Novidades).
   - Abre com Ctrl+K (⌘K no Mac), com "/" fora de campos de texto,
     pelo botão de lupa no cabeçalho ou pela barra do celular.
   - Procura: áreas (sigla/nome), tickets (número/designação) e
     comandos (só minhas áreas, novo torpedo, atualizar…).
   - Escolher uma área mostra o detalhe dela: RAL/REC/QUAL e os
     tickets mais perto de vencer o prazo, com barra de prazo.
   - Teclado: ↑ ↓ escolhe, Enter abre, Esc volta/fecha.
   ══════════════════════════════════════════════════════════════ */
const SirComando = (function () {
  const ligado = () => typeof SirRecursos === 'undefined' || SirRecursos.ativo('comando');
  let ov = null, inp = null, lista = null, det = null, itens = [], sel = 0, voltaFoco = null;
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const md = (tk, k) => (typeof modalData !== 'undefined' && modalData && modalData[tk] && modalData[tk][k]) || [];

  function monta() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'cmd-overlay'; ov.hidden = true;
    ov.innerHTML = `<div class="cmd-box" role="dialog" aria-modal="true" aria-labelledby="cmd-lbl">
      <label id="cmd-lbl" for="cmd-inp" class="cmd-lbl">Buscar área, ticket ou comando</label>
      <div class="cmd-field">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input id="cmd-inp" type="text" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="true" aria-controls="cmd-lista" aria-autocomplete="list" placeholder="Ex.: OE1, RAL-746901, torpedo">
        <button type="button" class="cmd-fechar" aria-label="Fechar busca (Esc)">Esc</button>
      </div>
      <div id="cmd-lista" class="cmd-lista" role="listbox" aria-label="Resultados"></div>
      <div class="cmd-det" hidden></div>
      <p class="cmd-dica">↑ ↓ para escolher · Enter para abrir · Esc para voltar</p>
    </div>`;
    document.body.appendChild(ov);
    inp = ov.querySelector('#cmd-inp'); lista = ov.querySelector('#cmd-lista'); det = ov.querySelector('.cmd-det');
    inp.addEventListener('input', () => { sel = 0; busca(); });
    inp.addEventListener('keydown', tecla);
    ov.addEventListener('mousedown', e => { if (e.target === ov) fecha(); });
    ov.querySelector('.cmd-fechar').addEventListener('click', fecha);
    lista.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) escolhe(+b.dataset.i); });
    ov.addEventListener('keydown', e => {   /* Esc volta/fecha; foco preso dentro da janela */
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!det.hidden) volta(); else fecha(); return; }
      if (e.key !== 'Tab') return;
      const f = [...ov.querySelectorAll('input, button:not([disabled])')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
  }

  function comandos() {
    const c = [];
    const mine = typeof getUserSavedAreas === 'function' && getUserSavedAreas().length;
    if (mine && typeof setV2Scope === 'function') {
      c.push({ t: 'Mostrar só minhas áreas', s: 'Filtra o painel', f: () => setV2Scope('mine') });
      c.push({ t: 'Mostrar todas as áreas', s: 'Volta ao painel completo', f: () => setV2Scope('all') });
    }
    if (typeof openTorpedos === 'function') c.push({ t: 'Novo torpedo', s: 'Abre o gerenciador de torpedos', f: () => openTorpedos() });
    if (typeof loadNow === 'function') c.push({ t: 'Atualizar dados agora', s: 'Busca RAL e REC de novo', f: () => loadNow() });
    if (typeof openSettings === 'function') c.push({ t: 'Escolher minhas áreas', s: 'Abre Minhas Áreas', f: () => openSettings() });
    if (typeof openPersonalizacao === 'function') c.push({ t: 'Abrir configurações', s: 'Tema, densidade, novidades', f: () => openPersonalizacao() });
    if (typeof cycleThemeMode === 'function') c.push({ t: 'Trocar tema', s: 'Escuro ou claro suave', f: () => cycleThemeMode() });
    if (typeof playReconnectVideo === 'function') c.push({ t: 'Vídeo de reconexão (mingau)', s: 'Atalho Ctrl + mingau', f: () => playReconnectVideo('shortcut'), secreto: true });
    return c.map(x => ({ tipo: 'Comando', ...x }));
  }

  function busca() {
    const q = norm(inp.value.trim()), r = [];
    const cfs = typeof REGIONS !== 'undefined' ? Object.entries(REGIONS).flatMap(([g, o]) => Object.keys(o).map(cf => ({ cf, g }))) : [];
    for (const { cf, g } of cfs) {
      const nome = (typeof CF_NAMES !== 'undefined' && CF_NAMES[cf]) || '';
      if (!q || norm(cf).includes(q) || norm(nome).includes(q) || norm(g).includes(q)) {
        const nr = md('ral', cf).length, nc = md('rec', cf).length;
        r.push({ tipo: 'Área', t: `${cf} · ${nome || g}`, s: `${g} · ${nr} RAL · ${nc} REC`, cf, peso: q && norm(cf) === q ? 0 : 1, n: nr + nc });
      }
    }
    if (!q) r.sort((a, b) => b.n - a.n);
    if (q.length >= 2) {
      for (const tk of ['ral', 'rec']) {
        for (const it of md(tk, 'ALL')) {
          if (norm(it.ticket).replace(/\s+/g, '').includes(q.replace(/\s+/g, '')) || norm(it.designacao).includes(q)) {
            r.push({ tipo: 'Ticket', t: it.ticket, s: `${it.cfOrigem || ''} · ${it.designacao || ''}`, it, isRal: tk === 'ral', peso: 2 });
            if (r.filter(x => x.tipo === 'Ticket').length >= 8) break;
          }
        }
      }
    }
    const cmds = comandos().filter(c => c.secreto
      ? (q.length >= 3 && (norm(c.t).includes(q) || norm(c.s).includes(q)))
      : (!q || norm(c.t).includes(q) || norm(c.s).includes(q)));
    itens = r.sort((a, b) => (a.peso || 1) - (b.peso || 1)).slice(0, q ? 12 : 8).concat(cmds.slice(0, q ? 6 : 4));
    if (sel >= itens.length) sel = 0;
    desenha();
  }

  function desenha() {
    lista.innerHTML = itens.length ? itens.map((x, i) =>
      `<button type="button" role="option" tabindex="-1" id="cmd-o${i}" data-i="${i}" class="cmd-item${i === sel ? ' on' : ''}" aria-selected="${i === sel}">
        <b class="cmd-tipo">${x.tipo}</b><span class="cmd-txt"><span>${esc(x.t)}</span><small>${esc(x.s)}</small></span>
      </button>`).join('') : '<p class="cmd-vazio">Nada encontrado. Tente a sigla da área (ex.: OE1) ou o número do ticket.</p>';
    if (itens.length) inp.setAttribute('aria-activedescendant', 'cmd-o' + sel); else inp.removeAttribute('aria-activedescendant');
    const on = lista.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }

  function tecla(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, itens.length); desenha(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + itens.length) % Math.max(1, itens.length); desenha(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (itens[sel]) escolhe(sel); }
  }

  function escolhe(i) {
    const x = itens[i];
    if (!x) return;
    if (x.tipo === 'Área') return detalhe(x.cf);
    if (x.tipo === 'Ticket') { fecha(); if (typeof openModal === 'function') openModal(x.it.cfOrigem, x.isRal, `${x.isRal ? 'RAL' : 'REC'} :: ${x.it.cfOrigem}`, x.it.ticket); return; }
    fecha(); x.f();
  }

  function detalhe(cf) {
    const nome = (typeof CF_NAMES !== 'undefined' && CF_NAMES[cf]) || '';
    const tks = [];
    for (const tk of ['ral', 'rec']) for (const it of md(tk, cf)) {
      const s = typeof calcSla === 'function' ? calcSla(it.abertura, tk === 'ral') : null;
      if (s) tks.push({ it, isRal: tk === 'ral', rest: s.remaining, lim: (tk === 'ral' ? 6 : 4) * 3600000 });
    }
    /* mais perto de vencer primeiro: os que ainda estão no prazo (menor tempo restante), depois os atrasados mais recentes */
    tks.sort((a, b) => (a.rest < 0) - (b.rest < 0) || (a.rest >= 0 ? a.rest - b.rest : b.rest - a.rest));
    const hm = ms => { const m = Math.round(Math.abs(ms) / 60000); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`; };
    const linhas = tks.slice(0, 6).map(x => {
      const pct = Math.min(100, Math.max(4, (1 - x.rest / x.lim) * 100));
      const cor = x.rest < 3600000 ? 'var(--v2-crit)' : x.rest <= 2 * 3600000 ? 'var(--v2-warn)' : 'var(--text-muted)';   /* vencido ou < 1h · até 2h · resto */
      return `<button type="button" class="cmd-tk" data-cf="${esc(cf)}" data-tk="${esc(x.it.ticket)}" data-ral="${x.isRal}" style="--c:${cor}">
        <span><b>${esc(x.it.ticket)}</b><small>${x.isRal ? 'RAL · prazo 6h' : 'REC · prazo 4h'}</small></span>
        <span class="cmd-tk-mid"><span>${esc(x.it.designacao || '')}</span><i style="width:${pct.toFixed(0)}%"></i></span>
        <b class="cmd-tk-r">${x.rest < 0 ? '+' + hm(x.rest) + ' atrasado' : 'faltam ' + hm(x.rest)}</b>
      </button>`;
    }).join('') || '<p class="cmd-vazio">Nenhum ticket aberto nesta área.</p>';
    const q = typeof qualCount === 'function' ? qualCount(cf) : '—';
    det.innerHTML = `<div class="cmd-det-top">
        <button type="button" class="cmd-voltar" aria-label="Voltar aos resultados">‹ Voltar</button>
        <h2 class="cmd-det-tit">${esc(cf)} · ${esc(nome)}</h2>
        <span class="cmd-det-n"><span>RAL <b>${md('ral', cf).length}</b></span><span>REC <b>${md('rec', cf).length}</b></span><span>QUAL <b>${q}</b></span></span>
      </div>
      <h3 class="cmd-det-sub">Mais perto de vencer o prazo</h3>
      <div class="cmd-det-lista">${linhas}</div>
      <div class="cmd-det-acoes">
        <button type="button" class="cmd-btn" data-lista="ral">Abrir lista de RAL</button>
        <button type="button" class="cmd-btn" data-lista="rec">Abrir lista de REC</button>
      </div>`;
    det.hidden = false; lista.hidden = true;
    det.querySelector('.cmd-voltar').onclick = volta;
    det.querySelectorAll('[data-lista]').forEach(b => b.onclick = () => { const r = b.dataset.lista === 'ral'; fecha(); openModal(cf, r, `${r ? 'RAL' : 'REC'} :: ${cf}`); });
    det.querySelectorAll('.cmd-tk').forEach(b => b.onclick = () => { const r = b.dataset.ral === 'true'; fecha(); openModal(b.dataset.cf, r, `${r ? 'RAL' : 'REC'} :: ${b.dataset.cf}`, b.dataset.tk); });
    det.querySelector('.cmd-voltar').focus();
  }
  function volta() { det.hidden = true; lista.hidden = false; inp.focus(); }

  function abre() {
    if (!ligado()) return;
    monta();
    voltaFoco = document.activeElement;
    ov.hidden = false; det.hidden = true; lista.hidden = false;
    inp.value = ''; sel = 0; busca();
    requestAnimationFrame(() => { ov.classList.add('on'); inp.focus(); });
  }
  function fecha() {
    if (!ov || ov.hidden) return;
    ov.classList.remove('on'); ov.hidden = true;
    if (voltaFoco && voltaFoco.focus) try { voltaFoco.focus({ preventScroll: true }); } catch (e) {}
  }

  document.addEventListener('keydown', e => {
    if (!ligado()) return;
    const k = (e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); ov && !ov.hidden ? fecha() : abre(); return; }
    if (k === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = e.target, tag = (t.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
      if (document.querySelector('.modal-overlay.active')) return;
      e.preventDefault(); abre();
    }
  });

  /* Botão de lupa no cabeçalho */
  function botao() {
    const quick = document.getElementById('hdr-quick');
    let b = document.getElementById('btn-cmd');
    if (!quick) return;
    if (!b) {
      b = document.createElement('button');
      b.type = 'button'; b.id = 'btn-cmd'; b.className = 'btn-settings btn-icon btn-cmd';
      b.title = 'Buscar (Ctrl K)'; b.setAttribute('aria-label', 'Buscar área, ticket ou comando');
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
      b.addEventListener('click', abre);
      quick.insertBefore(b, quick.firstChild);
    }
    b.hidden = !ligado();
  }
  document.addEventListener('DOMContentLoaded', botao);
  document.addEventListener('sir-recursos', e => { if (e.detail.id === 'comando') { botao(); if (!e.detail.ativo) fecha(); } });

  return { abre, fecha };
})();
