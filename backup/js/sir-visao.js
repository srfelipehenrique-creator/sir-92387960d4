/* ══════════════════════════════════════════════════════════════
   Visualização SIR — Login integrado + Visual Novo (Auto Embratel)
   Abre sem sair do dashboard para REDE 1 e REDE 2, solicita login/senha
   normal do SIR e libera o visual novo da Lista de Tarefas + Painel Geral.
   ══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const LS_USER = 'sir_visao_last_user';
  const LS_ANALISES = 'sir_visao_analises_v1';
  const LS_PLANTAO = 'sir_visao_plantao_v1';
  const LS_EQUIPES = 'sir_visao_equipes_v1';
  const LS_VOZ = 'sir_visao_voz';

  const st = {
    open: false,
    rede: 'rede1',
    loggedIn: false,
    usuario: '',
    tab: 'lista',      /* 'lista' | 'portal' */
    tipo: 'RAL',       /* 'RAL' | 'REC' */
    area: '*',         /* '*' | 'MINHAS' | 'DP' | 'NOVAS' | 'ROTA' | 'G_*' | '<CF>' */
    busca: '',
    ocultarQual: false,
    sortCol: 'sla',
    sortDir: 1,
    selChave: null,
    rail: false,
    mobLat: false,
    voz: false,
    dados: null,
    lastFocus: null,
    ringTimer: null
  };

  try { st.voz = localStorage.getItem(LS_VOZ) === '1'; } catch (e) {}

  const esc = s => (typeof escapeHtml === 'function')
    ? escapeHtml(String(s ?? ''))
    : String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function toastMsg(msg) {
    if (typeof showActionToast === 'function') { showActionToast(msg); return; }
    let t = document.getElementById('sv-toast-fallback');
    if (!t) {
      t = document.createElement('div');
      t.id = 'sv-toast-fallback';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      Object.assign(t.style, {
        position: 'fixed', bottom: '18px', left: '50%', transform: 'translateX(-50%)',
        zIndex: '10099', padding: '8px 16px', borderRadius: '999px',
        background: '#26272b', color: '#e8eaed', border: '1px solid #5f6368', fontSize: '13px', fontWeight: '600'
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.hidden = true; }, 2400);
  }

  function copiarTxt(txt, aviso) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txt).then(() => toastMsg(aviso || 'Copiado!'), () => fallbackCopy(txt, aviso));
    } else {
      fallbackCopy(txt, aviso);
    }
  }
  function fallbackCopy(txt, aviso) {
    const ta = document.createElement('textarea');
    ta.value = txt; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toastMsg(aviso || 'Copiado!'); } catch (e) { toastMsg('Não foi possível copiar'); }
    ta.remove();
  }

  function loadJson(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function saveJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function getMinhasAreas() {
    if (typeof getUserSavedAreas === 'function') {
      const a = getUserSavedAreas();
      if (Array.isArray(a) && a.length) return a;
    }
    return SirRegrasAE.AREAS.slice();
  }

  function isPainelGeralOpen() {
    const pg = document.getElementById('painel-geral-overlay');
    return !!(pg && !pg.hidden);
  }

  function ensureOverlay() {
    let ov = document.getElementById('sir-visao-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'sir-visao-overlay';
    ov.className = 'sv-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Visualização SIR');
    ov.hidden = true;
    document.body.appendChild(ov);
    return ov;
  }

  function syncMobileLateralInert() {
    const lat = document.getElementById('sv-lateral');
    if (!lat) return;
    const isMob = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
    if (isMob && !st.mobLat) lat.setAttribute('inert', '');
    else lat.removeAttribute('inert');
  }

  function openSirVisao(redeId) {
    if (redeId && SirRegrasAE.SIR_REDES[redeId]) st.rede = redeId;
    if (typeof closePainelGeral === 'function') closePainelGeral(true);
    if (!st.open) st.lastFocus = document.activeElement;
    st.open = true;
    st.tab = 'lista';
    const ov = ensureOverlay();
    ov.hidden = false;
    document.body.style.overflow = 'hidden';
    render();
    startRingTimer();
    if (st.loggedIn) setTimeout(() => ov.querySelector('#sv-back-main')?.focus({ preventScroll: true }), 40);
  }

  function closeSirVisao() {
    st.open = false;
    st.mobLat = false;
    stopRingTimer();
    const ov = document.getElementById('sir-visao-overlay');
    if (ov) ov.hidden = true;
    if (!isPainelGeralOpen()) {
      document.body.style.overflow = '';
      try { st.lastFocus?.focus?.({ preventScroll: true }); } catch (e) {}
    }
  }

  function startRingTimer() {
    stopRingTimer();
    st.ringTimer = setInterval(updateLiveIndicator, 1000);
  }
  function stopRingTimer() {
    if (st.ringTimer) { clearInterval(st.ringTimer); st.ringTimer = null; }
  }

  function updateLiveIndicator() {
    if (!st.open || !st.loggedIn || isPainelGeralOpen()) return;
    const sub = document.getElementById('sv-vivo-sub');
    const prog = document.getElementById('sv-anel-prog');
    if (!sub || !prog) return;
    const cd = typeof countdownVal === 'number' ? countdownVal : 0;
    const total = (typeof INTERVAL === 'number' ? INTERVAL : 120000) / 1000;
    const m = Math.floor(cd / 60), s = String(cd % 60).padStart(2, '0');
    const last = document.getElementById('last-update')?.textContent?.replace(/^Última atualização:\s*/i, '') || '--:--';
    sub.textContent = `${last} · ${m}:${s}`;
    const frac = Math.max(0, Math.min(1, 1 - (cd / total)));
    prog.style.strokeDashoffset = String((106.81 * (1 - frac)).toFixed(1));
  }

  function render(focusSelector) {
    const ov = ensureOverlay();
    if (!st.loggedIn) renderLogin(ov);
    else renderWorkspace(ov);
    if (focusSelector) {
      setTimeout(() => ov.querySelector(focusSelector)?.focus({ preventScroll: true }), 20);
    }
  }

  /* ── 1. Tela de Login normal do SIR ── */
  function renderLogin(ov) {
    const rede = SirRegrasAE.SIR_REDES[st.rede] || SirRegrasAE.SIR_REDES.rede1;
    const savedUser = (() => { try { return localStorage.getItem(LS_USER) || ''; } catch (e) { return ''; } })();
    const isHttps = location.protocol === 'https:';

    ov.innerHTML = `
      <div class="sv-topbar">
        <button type="button" class="sv-btn-back" id="sv-back-main">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Voltar ao dashboard principal
        </button>
        <div class="sv-net-switch" role="group" aria-label="Selecionar rede SIR">
          <button type="button" data-rede="rede1" aria-pressed="${st.rede === 'rede1'}" class="${st.rede === 'rede1' ? 'ativo' : ''}">REDE 1</button>
          <button type="button" data-rede="rede2" aria-pressed="${st.rede === 'rede2'}" class="${st.rede === 'rede2' ? 'ativo' : ''}">REDE 2</button>
        </div>
        <div class="sv-top-spacer"></div>
      </div>
      <div class="sv-login-wrap">
        <form class="sv-login-card" id="sv-login-form" autocomplete="on">
          <div class="sv-login-head">
            <div class="sv-login-logo" aria-hidden="true">SIR</div>
            <div>
              <h2>Acesso ao SIR · ${esc(rede.nome)}</h2>
              <p>Entre com seu login e senha normais do SIR para abrir o visual novo e o Painel Geral.</p>
            </div>
          </div>

          <div class="sv-login-net-box">
            <div class="sv-login-net-row">
              <strong style="font-size:12px;">Endereço selecionado (${esc(rede.nome)})</strong>
              <div class="sv-net-switch" role="group" aria-label="Alternar rede no login">
                <button type="button" data-rede="rede1" aria-pressed="${st.rede === 'rede1'}" class="${st.rede === 'rede1' ? 'ativo' : ''}">REDE 1</button>
                <button type="button" data-rede="rede2" aria-pressed="${st.rede === 'rede2'}" class="${st.rede === 'rede2' ? 'ativo' : ''}">REDE 2</button>
              </div>
            </div>
            <div class="sv-login-url">${esc(rede.url)}</div>
          </div>

          <div id="sv-login-err" class="sv-login-err" role="alert" hidden></div>

          <div class="sv-field">
            <label for="sv-inp-user">Usuário do SIR</label>
            <input type="text" id="sv-inp-user" name="username" autocomplete="username" placeholder="Ex.: T123456 ou seu login Claro" value="${esc(savedUser)}" required>
          </div>
          <div class="sv-field">
            <label for="sv-inp-pass">Senha do SIR</label>
            <input type="password" id="sv-inp-pass" name="password" autocomplete="current-password" placeholder="Digite sua senha do SIR" required>
          </div>

          <label class="sv-login-check">
            <input type="checkbox" id="sv-chk-lembrar" ${savedUser ? 'checked' : ''}>
            <span>Lembrar meu usuário neste navegador (a senha nunca é salva)</span>
          </label>

          <div class="sv-login-actions">
            <button type="submit" class="sv-btn-login">Entrar e abrir Visual Novo do SIR</button>
            <div class="sv-login-sec-row">
              <button type="button" class="sv-btn-sm" id="sv-open-native-pre">Abrir link ${esc(rede.nome)} na intranet</button>
              <button type="button" class="sv-btn-sm" id="sv-cancel-login">Voltar ao painel</button>
            </div>
          </div>

          <div class="sv-login-hint">
            ${isHttps
              ? '<b>Modo nuvem (HTTPS):</b> os dados ao vivo vêm do seu coletor/servidor na nuvem e funcionam em qualquer PC ou celular. Quando estiver na intranet da Claro, clique em <b>Portal SIR Nativo</b> ou <b>Abrir link na intranet</b> para autenticar também na janela direta do SIR.'
              : '<b>Modo local/intranet (HTTP):</b> após o login você pode alternar entre o <b>Visual Novo (Auto Embratel)</b>, o <b>Painel Geral</b> e o <b>Portal SIR Nativo embutido</b>.'}
          </div>
        </form>
      </div>
    `;

    ov.querySelector('#sv-back-main')?.addEventListener('click', closeSirVisao);
    ov.querySelector('#sv-cancel-login')?.addEventListener('click', closeSirVisao);
    ov.querySelectorAll('[data-rede]').forEach(b => b.addEventListener('click', () => {
      st.rede = b.dataset.rede;
      render(`[data-rede="${st.rede}"]`);
    }));
    ov.querySelector('#sv-open-native-pre')?.addEventListener('click', () => {
      window.open(rede.url, 'sir_intranet_' + rede.id, 'noopener');
    });
    ov.querySelector('#sv-login-form')?.addEventListener('submit', e => {
      e.preventDefault();
      const u = (ov.querySelector('#sv-inp-user')?.value || '').trim();
      const p = ov.querySelector('#sv-inp-pass')?.value || '';
      const errEl = ov.querySelector('#sv-login-err');
      if (!u || !p) {
        if (errEl) { errEl.textContent = 'Informe seu usuário e senha do SIR.'; errEl.hidden = false; }
        return;
      }
      const lembrar = ov.querySelector('#sv-chk-lembrar')?.checked;
      try {
        if (lembrar) localStorage.setItem(LS_USER, u);
        else localStorage.removeItem(LS_USER);
      } catch (err) {}
      st.usuario = u;
      st.loggedIn = true;
      st.tab = 'lista';
      toastMsg(`Conectado ao SIR (${rede.nome}) como ${u}`);
      render('#sv-back-main');
      if (typeof loadNow === 'function' && (!modalData.ral.ALL || !modalData.ral.ALL.length)) {
        loadNow();
      }
    });
    setTimeout(() => {
      const target = savedUser ? ov.querySelector('#sv-inp-pass') : ov.querySelector('#sv-inp-user');
      target?.focus({ preventScroll: true });
    }, 40);
  }

  /* ── 2. Workspace Pós-Login (Visual Novo + Portal + Botão Painel Geral) ── */
  function renderWorkspace(ov) {
    const rede = SirRegrasAE.SIR_REDES[st.rede] || SirRegrasAE.SIR_REDES.rede1;
    st.dados = SirRegrasAE.coletarItensAtivos();
    const dados = st.dados;
    const isHttps = location.protocol === 'https:';

    ov.innerHTML = `
      <div class="sv-topbar">
        <button type="button" class="sv-btn-back" id="sv-back-main">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          <span>Dashboard principal</span>
        </button>

        <button type="button" class="sv-btn-sm sv-mob-areas-btn" id="sv-mob-areas" aria-expanded="${st.mobLat}" aria-controls="sv-lateral" aria-label="Áreas e filtros"><span aria-hidden="true">☰</span> Áreas</button>

        <div class="sv-net-switch" role="group" aria-label="Alternar rede SIR">
          <button type="button" data-rede="rede1" aria-pressed="${st.rede === 'rede1'}" class="${st.rede === 'rede1' ? 'ativo' : ''}" title="${esc(SirRegrasAE.SIR_REDES.rede1.url)}">REDE 1</button>
          <button type="button" data-rede="rede2" aria-pressed="${st.rede === 'rede2'}" class="${st.rede === 'rede2' ? 'ativo' : ''}" title="${esc(SirRegrasAE.SIR_REDES.rede2.url)}">REDE 2</button>
        </div>

        <div class="sv-view-tabs" role="tablist" aria-label="Modo de exibição SIR">
          <button type="button" role="tab" aria-selected="${st.tab === 'lista'}" class="sv-tab-btn ${st.tab === 'lista' ? 'ativo' : ''}" data-tab="lista">Lista SIR (Visual Novo)</button>
          <button type="button" role="tab" aria-selected="${st.tab === 'portal'}" class="sv-tab-btn ${st.tab === 'portal' ? 'ativo' : ''}" data-tab="portal">Portal ${esc(rede.nome)}</button>
        </div>
        <button type="button" class="sv-tab-btn destaque" id="sv-open-pg">Painel Geral (2º Dashboard)</button>

        <div class="sv-top-spacer"></div>
        <span class="sv-user-chip" title="Sessão ativa na ${esc(rede.nome)}"><i aria-hidden="true"></i>${esc(st.usuario)}</span>
        <button type="button" class="sv-btn-sm" id="sv-logout" title="Sair e trocar login do SIR">Sair</button>
      </div>

      <div class="sv-shell" id="sv-shell-lista" ${st.tab !== 'lista' ? 'hidden' : ''}>
        <aside class="sv-lateral ${st.rail ? 'recolhida' : ''} ${st.mobLat ? 'mob-aberta' : ''}" id="sv-lateral" aria-label="Navegação da lista SIR">
          <div class="sv-vivo">
            <button type="button" class="sv-anel" id="sv-btn-refresh" title="Atualizar REC e RAL agora" aria-label="Atualizar REC e RAL agora">
              <svg class="ring" viewBox="0 0 40 40" aria-hidden="true">
                <circle class="trilho" cx="20" cy="20" r="17"/>
                <circle class="prog" id="sv-anel-prog" cx="20" cy="20" r="17" stroke-dashoffset="0"/>
              </svg>
              <span aria-hidden="true">↻</span>
            </button>
            <div class="sv-vivo-txt sv-hide-rail">
              <b>Ao vivo</b>
              <span id="sv-vivo-sub">Sincronizado</span>
            </div>
          </div>

          <button type="button" class="sv-btn-sm sv-hide-rail" id="sv-btn-plantao" style="justify-content:space-between;">
            <span><span aria-hidden="true">📋 </span>Plantão &amp; DP</span><kbd style="font-size:11px;opacity:.75;">P</kbd>
          </button>

          <div class="sv-busca sv-hide-rail" title="Busca em todas as áreas, REC e RAL (atalho: /)">
            <span aria-hidden="true">🔍</span>
            <input type="search" id="sv-busca-inp" aria-label="Buscar ticket, designação, cliente, CF ou status" placeholder="Buscar ticket, desig…" value="${esc(st.busca)}" autocomplete="off" spellcheck="false">
          </div>

          <div class="sv-seg" role="tablist" aria-label="Tipo de lista">
            <button type="button" role="tab" aria-selected="${st.tipo === 'RAL'}" data-tipo="RAL" class="${st.tipo === 'RAL' ? 'ativo' : ''}">RAL <span class="n" id="sv-cnt-ral">${dados.RAL.length}</span></button>
            <button type="button" role="tab" aria-selected="${st.tipo === 'REC'}" data-tipo="REC" class="${st.tipo === 'REC' ? 'ativo' : ''}">REC <span class="n" id="sv-cnt-rec">${dados.REC.length}</span></button>
          </div>

          <nav class="sv-areas sv-hide-rail" id="sv-areas-nav" aria-label="Áreas"></nav>

          <div class="sv-lat-foot">
            <button type="button" class="sv-ico-btn" id="sv-btn-voz" aria-pressed="${st.voz ? 'true' : 'false'}" title="Anúncio por voz" aria-label="Anúncio por voz"><span aria-hidden="true">${st.voz ? '🔊' : '🔇'}</span></button>
            <button type="button" class="sv-ico-btn" id="sv-btn-email" title="E-mail de liberação de acesso" aria-label="E-mail de liberação"><span aria-hidden="true">✉</span></button>
            <button type="button" class="sv-ico-btn" id="sv-btn-critel-all" title="Verificar designações no Critel" aria-label="Abrir Critel"><span aria-hidden="true">📈</span></button>
            <button type="button" class="sv-ico-btn" id="sv-btn-rail" aria-expanded="${!st.rail}" title="${st.rail ? 'Expandir barra lateral' : 'Recolher barra lateral'}" aria-label="${st.rail ? 'Expandir barra lateral' : 'Recolher barra lateral'}" style="margin-left:auto;"><span aria-hidden="true">${st.rail ? '»' : '«'}</span></button>
          </div>
        </aside>

        <main class="sv-main">
          <div class="sv-grade-wrap">
            <div class="sv-subbar" id="sv-subbar"></div>
            <div class="sv-table-scroll" id="sv-table-scroll"></div>
          </div>
          <aside class="sv-gaveta" id="sv-gaveta" ${st.selChave ? '' : 'hidden'} aria-label="Detalhe do ticket"></aside>
        </main>
      </div>

      <div class="sv-portal-wrap" id="sv-portal-wrap" ${st.tab !== 'portal' ? 'hidden' : ''}>
        <div class="sv-portal-banner">
          <span><b>${esc(rede.nome)}</b> · <code>${esc(rede.url)}</code></span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="sv-btn-sm prim" id="sv-portal-open-win">Abrir ${esc(rede.nome)} em janela externa</button>
            <button type="button" class="sv-btn-sm" data-tab="lista">Voltar para Lista Visual Novo</button>
          </div>
        </div>
        ${isHttps
          ? `<div class="sv-portal-https-card">
               <h3>Conexão direta com a intranet (${esc(rede.nome)})</h3>
               <p>Este painel está hospedado em <b>HTTPS na nuvem</b>. Por política de segurança do navegador (Mixed Content), páginas internas <code>http://10.x.x.x</code> não podem ser embutidas dentro de um iframe HTTPS.</p>
               <p>Para operar com as duas telas juntas na rede da Claro:</p>
               <p>1. Use o <b>Visual Novo</b> e o <b>Painel Geral</b> aqui dentro (alimentados em tempo real pelo seu Coletor Windows <code>w8</code> com suporte à REDE 1 e REDE 2).</p>
               <p>2. Clique abaixo para abrir o portal nativo <code>${esc(rede.url)}</code> em uma janela dedicada da intranet.</p>
               <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
                 <button type="button" class="sv-btn-sm prim" id="sv-portal-open-win2">Abrir ${esc(rede.nome)} (${esc(rede.host)})</button>
                 <button type="button" class="sv-btn-sm" id="sv-portal-open-pg2">Ir para o Painel Geral (2º Dashboard)</button>
               </div>
             </div>`
          : `<iframe class="sv-portal-iframe" src="${esc(rede.url)}" title="Portal SIR ${esc(rede.nome)}"></iframe>`}
      </div>

      <div class="sv-submodal-bg" id="sv-submodal-bg" hidden></div>
    `;

    bindWorkspaceEvents(ov, rede);
    syncMobileLateralInert();
    if (st.tab === 'lista') {
      renderAreasNav(ov, st.dados);
      renderTableAndDrawer(ov, st.dados);
    }
    updateLiveIndicator();
  }

  function bindWorkspaceEvents(ov, rede) {
    ov.querySelector('#sv-back-main')?.addEventListener('click', closeSirVisao);
    ov.querySelector('#sv-logout')?.addEventListener('click', () => {
      st.loggedIn = false;
      st.selChave = null;
      render();
    });
    ov.querySelector('#sv-open-pg')?.addEventListener('click', () => {
      if (typeof openPainelGeral === 'function') openPainelGeral(st.rede, st.usuario);
    });
    ov.querySelector('#sv-portal-open-pg2')?.addEventListener('click', () => {
      if (typeof openPainelGeral === 'function') openPainelGeral(st.rede, st.usuario);
    });
    ov.querySelectorAll('[data-rede]').forEach(b => b.addEventListener('click', () => {
      st.rede = b.dataset.rede;
      toastMsg('Rede alterada para ' + SirRegrasAE.SIR_REDES[st.rede].nome);
      render(`[data-rede="${st.rede}"]`);
    }));
    ov.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      st.tab = b.dataset.tab;
      render(`[data-tab="${st.tab}"]`);
    }));
    ov.querySelector('#sv-portal-open-win')?.addEventListener('click', () => window.open(rede.url, 'sir_intranet_' + rede.id, 'noopener'));
    ov.querySelector('#sv-portal-open-win2')?.addEventListener('click', () => window.open(rede.url, 'sir_intranet_' + rede.id, 'noopener'));
    ov.querySelector('#sv-mob-areas')?.addEventListener('click', () => {
      st.mobLat = !st.mobLat;
      ov.querySelector('#sv-lateral')?.classList.toggle('mob-aberta', st.mobLat);
      ov.querySelector('#sv-mob-areas')?.setAttribute('aria-expanded', String(st.mobLat));
      syncMobileLateralInert();
    });
    ov.querySelector('#sv-btn-rail')?.addEventListener('click', () => {
      st.rail = !st.rail;
      render('#sv-btn-rail');
    });
    ov.querySelector('#sv-btn-refresh')?.addEventListener('click', () => {
      if (typeof loadNow === 'function') { loadNow(); toastMsg('Atualizando listas RAL e REC…'); }
    });
    ov.querySelectorAll('.sv-seg button[data-tipo]').forEach(b => b.addEventListener('click', () => {
      st.tipo = b.dataset.tipo;
      if (st.area === 'DP' || st.area === 'NOVAS' || st.area === 'ROTA') st.area = '*';
      st.selChave = null;
      render(`.sv-seg button[data-tipo="${st.tipo}"]`);
    }));
    ov.querySelector('#sv-busca-inp')?.addEventListener('input', e => {
      st.busca = e.target.value;
      renderTableAndDrawer(ov, st.dados || SirRegrasAE.coletarItensAtivos());
    });
    ov.querySelector('#sv-btn-voz')?.addEventListener('click', () => {
      st.voz = !st.voz;
      try { localStorage.setItem(LS_VOZ, st.voz ? '1' : '0'); } catch (e) {}
      if (st.voz) SirRegrasAE.falar('Anúncio por voz ativado');
      render('#sv-btn-voz');
    });
    ov.querySelector('#sv-btn-email')?.addEventListener('click', () => openEmailModal(null));
    ov.querySelector('#sv-btn-plantao')?.addEventListener('click', () => openPlantaoModal());
    ov.querySelector('#sv-btn-critel-all')?.addEventListener('click', () => {
      const lista = getFilteredItems(st.dados || SirRegrasAE.coletarItensAtivos())
        .map(i => SirRegrasAE.designacaoCritel(i.desig)).filter(Boolean);
      const unicas = [...new Set(lista)].slice(0, 30);
      if (!unicas.length) { toastMsg('Nenhuma designação válida de Critel na visão atual'); return; }
      window.open(SirRegrasAE.urlCritel(unicas), '_blank', 'noopener');
    });
  }

  /* Compatível com inbox.js (identity, typeKey, cfOrigem) */
  function getNovasSet() {
    const s = new Set();
    if (typeof appState !== 'undefined' && Array.isArray(appState.inboxItems)) {
      const ack = appState.acknowledgedInboxKeys || new Set();
      appState.inboxItems.forEach(i => {
        const id = i.identity || i.key;
        if (!id || ack.has(id)) return;
        const tp = String(i.typeKey || i.type || '').toUpperCase();
        if (tp && i.ticket) s.add(`${tp}|${i.ticket}`);
      });
    }
    return s;
  }

  function getRotaItems(dados) {
    const minhas = new Set(getMinhasAreas());
    const agora = Date.now();
    return [...dados.RAL, ...dados.REC].filter(it => {
      if (it.q || !minhas.has(it.cod)) return false;
      const semInfo = it.st === 'so-st-fora';
      const sla = SirRegrasAE.slaRestante(it, agora);
      const vencidoOuPerto = sla != null && sla <= 30;
      return semInfo || vencidoOuPerto;
    });
  }

  function getFilteredItems(dados) {
    const q = SirRegrasAE.semAcento(st.busca.trim()).toLowerCase();
    const minhas = new Set(getMinhasAreas());
    const novasSet = getNovasSet();
    let base = [];

    if (q) {
      base = [...dados.DP, ...dados.RAL, ...dados.REC];
      if (!st.ocultarQual) base = base.concat(dados.QUAL);
      base = base.filter(it => {
        const assocStr = (it.assoc || []).map(a => `${a.ticket} ${a.cliente} ${a.designacao}`).join(' ');
        const hay = SirRegrasAE.semAcento(`${it.num} ${it.desig} ${it.ex} ${it.cf} ${it.cod} ${it.tec} ${it.sr} ${it.nota} ${assocStr}`).toLowerCase();
        return hay.includes(q);
      });
    } else if (st.area === 'DP') {
      base = dados.DP.filter(d => !d.tec);
    } else if (st.area === 'NOVAS') {
      base = [...dados.RAL, ...dados.REC].filter(it => novasSet.has(`${it.tipo}|${it.num}`));
    } else if (st.area === 'ROTA') {
      base = getRotaItems(dados);
    } else {
      const listaTipo = dados[st.tipo] || [];
      const dpTipo = dados.DP.filter(d => d.tipo === st.tipo && !d.tec);
      if (st.area === '*') {
        base = [...dpTipo, ...listaTipo];
        if (st.tipo === 'RAL' && !st.ocultarQual) base = base.concat(dados.QUAL);
      } else if (st.area === 'MINHAS') {
        base = listaTipo.filter(i => minhas.has(i.cod));
        if (st.tipo === 'RAL' && !st.ocultarQual) base = base.concat(dados.QUAL.filter(i => minhas.has(i.cod)));
      } else if (st.area.startsWith('G_')) {
        const g = SirRegrasAE.GRUPOS.find(x => x.cod === st.area);
        const cfs = new Set(g ? g.regioes.map(r => r.cod) : []);
        base = listaTipo.filter(i => cfs.has(i.cod));
        if (st.tipo === 'RAL' && !st.ocultarQual) base = base.concat(dados.QUAL.filter(i => cfs.has(i.cod)));
      } else {
        base = listaTipo.filter(i => i.cod === st.area);
        if (st.tipo === 'RAL' && !st.ocultarQual) base = base.concat(dados.QUAL.filter(i => i.cod === st.area));
      }
    }

    const agora = Date.now();
    base.sort((a, b) => {
      if (st.area === '*' && !q) {
        const aDp = a.cod === 'DP' ? 0 : 1, bDp = b.cod === 'DP' ? 0 : 1;
        if (aDp !== bDp) return aDp - bDp;
      }
      const dir = st.sortDir;
      switch (st.sortCol) {
        case 'cf':    return a.cf.localeCompare(b.cf) * dir;
        case 'num':   return a.num.localeCompare(b.num) * dir;
        case 'desig': return a.desig.localeCompare(b.desig) * dir;
        case 'ex':    return a.ex.localeCompare(b.ex) * dir;
        case 'ab':    return ((a.ab ?? 9e15) - (b.ab ?? 9e15)) * dir;
        case 'dur':   return ((a.cfDesde ?? 9e15) - (b.cfDesde ?? 9e15)) * dir;
        case 'st':    return a.sr.localeCompare(b.sr) * dir;
        case 'tec':   return a.tec.localeCompare(b.tec) * dir;
        case 'ass':   return (b.assN - a.assN) * dir;
        case 'sla':
        default: {
          const sa = SirRegrasAE.slaRestante(a, agora);
          const sb = SirRegrasAE.slaRestante(b, agora);
          return ((sa == null ? 9e9 : sa) - (sb == null ? 9e9 : sb)) * dir;
        }
      }
    });
    return base;
  }

  function renderAreasNav(ov, dados) {
    const nav = ov.querySelector('#sv-areas-nav');
    if (!nav) return;
    const agora = Date.now();
    const minhas = new Set(getMinhasAreas());
    const listaTipo = dados[st.tipo] || [];
    const minhasCount = listaTipo.filter(i => minhas.has(i.cod)).length;
    const dpCount = dados.DP.filter(d => !d.tec).length;
    const novasCount = getNovasSet().size;
    const rotaCount = getRotaItems(dados).length;

    let html = `
      <div>
        <button type="button" class="sv-area-btn ${st.area === '*' ? 'ativo' : ''}" data-area="*">
          <span class="nm">Todas (${esc(st.tipo)})</span><span class="ct">${listaTipo.length}</span>
        </button>
        <button type="button" class="sv-area-btn ${st.area === 'MINHAS' ? 'ativo' : ''}" data-area="MINHAS">
          <span class="nm">Minhas áreas</span><span class="ct">${minhasCount}</span>
        </button>
        <button type="button" class="sv-area-btn dp ${st.area === 'DP' ? 'ativo' : ''}" data-area="DP">
          <span class="nm">Triagem DP</span><span class="ct">${dpCount}</span>
        </button>
        <button type="button" class="sv-area-btn ${st.area === 'NOVAS' ? 'ativo' : ''}" data-area="NOVAS">
          <span class="nm">Novas entradas</span><span class="ct">${novasCount}</span>
        </button>
        <button type="button" class="sv-area-btn rota ${st.area === 'ROTA' ? 'ativo' : ''}" data-area="ROTA">
          <span class="nm">Rota de Ação</span><span class="ct">${rotaCount}</span>
        </button>
      </div>
    `;

    SirRegrasAE.GRUPOS.forEach(g => {
      const grpItems = listaTipo.filter(i => g.regioes.some(r => r.cod === i.cod));
      html += `<div>
        <button type="button" class="sv-grp-hd ${st.area === g.cod ? 'ativo' : ''}" data-area="${esc(g.cod)}">
          <span>${esc(g.nome)}</span><span>${grpItems.length}</span>
        </button>
        <div class="sv-cfs-grid">`;
      g.regioes.forEach(r => {
        const cfItems = listaTipo.filter(i => i.cod === r.cod);
        const temVenc = cfItems.some(i => SirRegrasAE.nivelSLA(SirRegrasAE.slaRestante(i, agora), i.tipo) === 2);
        html += `<button type="button" class="sv-cf-chip ${cfItems.length === 0 ? 'zero' : ''} ${st.area === r.cod ? 'ativo' : ''}" data-area="${esc(r.cod)}" title="${esc(r.nome)}${temVenc ? ' · SLA vencido' : ''}">
          <span>${esc(r.cod)}</span><b>${cfItems.length}</b>${temVenc ? '<i class="dot-sla" aria-hidden="true"></i>' : ''}
        </button>`;
      });
      html += `</div></div>`;
    });

    nav.innerHTML = html;
    nav.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => {
      st.area = b.dataset.area;
      st.mobLat = false;
      ov.querySelector('#sv-lateral')?.classList.remove('mob-aberta');
      ov.querySelector('#sv-mob-areas')?.setAttribute('aria-expanded', 'false');
      syncMobileLateralInert();
      renderAreasNav(ov, st.dados || dados);
      renderTableAndDrawer(ov, st.dados || dados);
    }));
  }

  function corInfo(key) {
    const m = (typeof SWATCH_COLORS !== 'undefined' ? SWATCH_COLORS : []).find(c => c.key === key);
    return m ? { bg: m.bg, label: m.label } : { bg: '', label: 'Sem cor' };
  }

  function renderTableAndDrawer(ov, dados) {
    const subbar = ov.querySelector('#sv-subbar');
    const scroll = ov.querySelector('#sv-table-scroll');
    const gaveta = ov.querySelector('#sv-gaveta');
    if (!subbar || !scroll || !gaveta) return;

    const itens = getFilteredItems(dados);
    const agora = Date.now();
    const vencidos = itens.filter(i => SirRegrasAE.nivelSLA(SirRegrasAE.slaRestante(i, agora), i.tipo) === 2).length;
    const areaLabel = st.busca.trim() ? `Busca: "${st.busca.trim()}"`
      : st.area === '*' ? `Todas as áreas · ${st.tipo}`
      : st.area === 'MINHAS' ? `Minhas áreas · ${st.tipo}`
      : st.area === 'DP' ? 'Triagem DP sem técnico (REC + RAL)'
      : st.area === 'NOVAS' ? 'Novas entradas'
      : st.area === 'ROTA' ? 'Rota de Ação (sem status ou SLA ≤ 30 min)'
      : (SirRegrasAE.NOMES[st.area] || st.area);

    subbar.innerHTML = `
      <b>${esc(areaLabel)}</b>
      <span>· ${itens.length} ticket(s)${vencidos ? ` · <strong style="color:var(--sv-critico);">${vencidos} SLA vencido</strong>` : ''}</span>
      <span style="flex:1;"></span>
      ${st.tipo === 'RAL' ? `<label><input type="checkbox" id="sv-chk-qual" ${st.ocultarQual ? 'checked' : ''}> Ocultar qualidade (${dados.QUAL.length})</label>` : ''}
      <button type="button" class="sv-btn-sm" id="sv-btn-copy-desigs" title="Copiar designações visíveis">Copiar desig.</button>
    `;

    subbar.querySelector('#sv-chk-qual')?.addEventListener('change', e => {
      st.ocultarQual = e.target.checked;
      renderTableAndDrawer(ov, st.dados || dados);
    });
    subbar.querySelector('#sv-btn-copy-desigs')?.addEventListener('click', () => {
      const ds = [...new Set(itens.map(i => i.desig).filter(d => d && d !== 'N/D'))];
      if (!ds.length) { toastMsg('Nenhuma designação na lista'); return; }
      copiarTxt(ds.join('\n'), `${ds.length} designação(ões) copiada(s)`);
    });

    if (!itens.length) {
      scroll.innerHTML = `<div class="sv-vazio">
        <b>${st.area === 'DP' ? 'DP de REC/RAL Zerado!' : 'Nenhum ticket nesta visão'}</b>
        <span>${st.area === 'DP' ? 'Sem pendências em Triagem DP no momento.' : 'Ajuste o filtro ou aguarde a próxima atualização do coletor.'}</span>
      </div>`;
    } else {
      const misto = !!(st.busca.trim() || st.area === 'DP' || st.area === 'NOVAS' || st.area === 'ROTA');
      const cols = [
        { id: 'cor',   rot: 'Cor', sortable: false },
        { id: 'cf',    rot: 'CF', sortable: true },
        { id: 'num',   rot: 'Ticket', sortable: true },
        { id: 'desig', rot: 'Designação', sortable: true },
        { id: 'ex',    rot: misto ? 'Tipo / Cliente' : (st.tipo === 'RAL' ? 'Tipo RAL' : 'Cliente'), sortable: true },
        { id: 'ab',    rot: 'Abertura', sortable: true },
        { id: 'sla',   rot: 'SLA', sortable: true },
        { id: 'st',    rot: 'Status', sortable: true },
        { id: 'tec',   rot: 'Técn.', sortable: true },
        { id: 'ass',   rot: 'Ass.', sortable: true }
      ];
      const thHtml = cols.map(c => {
        if (!c.sortable) return `<th scope="col" style="padding:9px 10px;"><span class="sv-sr-only">${esc(c.rot)}</span></th>`;
        const act = st.sortCol === c.id;
        const sortAttr = act ? (st.sortDir === 1 ? 'ascending' : 'descending') : 'none';
        const arr = act ? (st.sortDir === 1 ? ' ↑' : ' ↓') : '';
        return `<th scope="col" aria-sort="${sortAttr}" class="${act ? 'ord-ativa' : ''}"><button type="button" class="sv-th-btn" data-sort="${c.id}">${esc(c.rot)}${arr}</button></th>`;
      }).join('');

      const rowsHtml = itens.map(it => {
        const slaMin = SirRegrasAE.slaRestante(it, agora);
        const niv = SirRegrasAE.nivelSLA(slaMin, it.tipo);
        const slaTxt = SirRegrasAE.formatSlaPill(slaMin);
        const urlTk = SirRegrasAE.urlDoTicket(it, st.rede);
        const dCritel = SirRegrasAE.designacaoCritel(it.desig);
        const cor = corInfo(it.cor);
        const selCls = st.selChave === it.chave ? 'sel' : '';
        const dpCls = it.cod === 'DP' ? 'em-dp' : '';
        const qCls = it.q ? 'qual' : '';
        return `<tr tabindex="0" data-chave="${esc(it.chave)}" data-tipo="${esc(it.tipo)}" class="${selCls} ${dpCls} ${qCls}" aria-selected="${st.selChave === it.chave}">
          <td><span class="sv-dot-cor" style="${cor.bg ? `background:${cor.bg};border-color:${cor.bg};` : ''}" title="${esc(cor.label)}"></span><span class="sv-sr-only">${esc(cor.label)}</span></td>
          <td><span class="sv-cf-pill ${it.cod === 'DP' ? 'dp' : ''}" title="${esc(it.cfRaw)}">${esc(it.cf)}</span></td>
          <td>
            ${misto ? `<span class="sv-tipo-tag ${esc(it.tipo)}">${esc(it.tipo)}</span>` : ''}
            <a class="sv-tk-link" href="${esc(urlTk)}" target="_blank" rel="noopener" title="Abrir ticket na ${esc(SirRegrasAE.SIR_REDES[st.rede].nome)}">${esc(it.num)}</a>
          </td>
          <td title="${esc(it.desig)}">
            ${dCritel
              ? `<a class="sv-desig-link" href="${esc(SirRegrasAE.urlCritel(dCritel))}" target="_blank" rel="noopener" title="Verificar no Critel">${esc(it.desig)}</a>`
              : esc(it.desig)}
          </td>
          <td title="${esc(it.ex)}">${esc(it.ex)}</td>
          <td style="font-family:var(--sv-mono);font-size:11.5px;color:var(--sv-apagado);">${esc(it.abertura || '—')}</td>
          <td><span class="sv-sla ${niv != null ? 'n' + niv : ''}">${esc(slaTxt)}</span></td>
          <td title="${esc(it.sd)}"><span class="sv-st ${esc(it.st)}">${esc(it.sr)}</span></td>
          <td style="color:var(--sv-apagado);font-size:11.5px;">${esc(it.tec || '—')}</td>
          <td>${it.assN > 0 ? `<span class="sv-ass-chip">REC ${it.assN}</span>` : '—'}</td>
        </tr>`;
      }).join('');

      scroll.innerHTML = `<table class="sv-table"><thead><tr>${thHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;

      scroll.querySelectorAll('button[data-sort]').forEach(btn => btn.addEventListener('click', () => {
        const col = btn.dataset.sort;
        if (st.sortCol === col) st.sortDir = -st.sortDir;
        else { st.sortCol = col; st.sortDir = 1; }
        renderTableAndDrawer(ov, st.dados || dados);
        ov.querySelector(`button[data-sort="${col}"]`)?.focus({ preventScroll: true });
      }));

      const selectRow = tr => {
        st.selChave = tr.dataset.chave;
        renderTableAndDrawer(ov, st.dados || dados);
      };
      scroll.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('click', e => {
          if (e.target.closest('a')) return;
          selectRow(tr);
        });
        tr.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.target.closest('a')) return;
            e.preventDefault();
            selectRow(tr);
          }
        });
      });
    }

    const selItem = itens.find(i => i.chave === st.selChave)
      || [...dados.DP, ...dados.RAL, ...dados.REC, ...dados.QUAL].find(i => i.chave === st.selChave);
    renderDrawer(gaveta, selItem, ov, dados);
  }

  function renderDrawer(gaveta, it, ov, dados) {
    if (!it) { gaveta.hidden = true; return; }
    gaveta.hidden = false;
    const agora = Date.now();
    const slaMin = SirRegrasAE.slaRestante(it, agora);
    const niv = SirRegrasAE.nivelSLA(slaMin, it.tipo);
    const urlTk = SirRegrasAE.urlDoTicket(it, st.rede);
    const dCritel = SirRegrasAE.designacaoCritel(it.desig);
    const analises = loadJson(LS_ANALISES, {});
    const an = analises[it.num] || { problema: '', alarme: '', acao: '', previsao: '' };
    const assocHtml = (it.assoc && it.assoc.length)
      ? it.assoc.map(a => `<div style="font:11.5px var(--sv-mono);padding:4px 6px;border-radius:6px;background:var(--sv-bg);">${esc(a.ticket)} · ${esc(a.cliente || a.designacao || '')}</div>`).join('')
      : '<span style="color:var(--sv-fraco);font-size:12px;">Nenhuma associação listada</span>';

    gaveta.innerHTML = `
      <div class="sv-gv-hd">
        <div>
          <span class="sv-tipo-tag ${esc(it.tipo)}">${esc(it.tipo)}</span>
          <h3 style="display:inline;">${esc(it.num)}</h3>
        </div>
        <button type="button" class="sv-btn-sm" id="sv-gv-close" aria-label="Fechar detalhe do ticket">✕</button>
      </div>
      <div class="sv-gv-bd">
        <div class="sv-gv-acoes">
          <a class="sv-btn-sm prim" href="${esc(urlTk)}" target="_blank" rel="noopener">Abrir no SIR (${esc(SirRegrasAE.SIR_REDES[st.rede].nome)})</a>
          ${dCritel ? `<a class="sv-btn-sm" href="${esc(SirRegrasAE.urlCritel(dCritel))}" target="_blank" rel="noopener">Critel</a>` : ''}
          <button type="button" class="sv-btn-sm" id="sv-gv-copy">Copiar nº</button>
          <button type="button" class="sv-btn-sm" id="sv-gv-email">E-mail</button>
          <button type="button" class="sv-btn-sm" id="sv-gv-torpedo">Torpedo</button>
        </div>

        <dl class="sv-gv-dl">
          <dt>CF</dt><dd><span class="sv-cf-pill ${it.cod === 'DP' ? 'dp' : ''}">${esc(it.cf)}</span> <small style="color:var(--sv-apagado);">${esc(it.cfRaw)}</small></dd>
          <dt>Designação</dt><dd style="font-family:var(--sv-mono);">${esc(it.desig)}</dd>
          <dt>${it.tipo === 'RAL' ? 'Tipo RAL' : 'Cliente'}</dt><dd>${esc(it.ex)}</dd>
          <dt>Abertura</dt><dd style="font-family:var(--sv-mono);">${esc(it.abertura || '—')}</dd>
          <dt>SLA</dt><dd><span class="sv-sla ${niv != null ? 'n' + niv : ''}">${esc(SirRegrasAE.formatSlaPill(slaMin))}</span></dd>
          <dt>Técnico</dt><dd>${esc(it.tec || 'Sem técnico')}</dd>
          <dt>Status</dt><dd><span class="sv-st ${esc(it.st)}">${esc(it.sr)}</span></dd>
        </dl>

        <div>
          <div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--sv-apagado);margin-bottom:6px;">Análise rápida (máscara local)</div>
          <div class="sv-analise-box">
            <label for="sv-an-prob">Problema<input type="text" id="sv-an-prob" value="${esc(an.problema)}" placeholder="Ex.: Rompimento FO / Sem energia"></label>
            <label for="sv-an-alarme">Alarme / Critel<input type="text" id="sv-an-alarme" value="${esc(an.alarme)}" placeholder="Ex.: LOS na porta / Queda total"></label>
            <label for="sv-an-acao">Ação tomada<textarea id="sv-an-acao" rows="2" placeholder="Equipe acionada, acesso solicitado...">${esc(an.acao)}</textarea></label>
            <label for="sv-an-prev">Previsão<input type="text" id="sv-an-prev" value="${esc(an.previsao)}" placeholder="Ex.: 18:00"></label>
            <div style="display:flex;gap:6px;margin-top:4px;">
              <button type="button" class="sv-btn-sm prim" id="sv-an-save">Salvar</button>
              <button type="button" class="sv-btn-sm" id="sv-an-copy">Copiar máscara</button>
            </div>
          </div>
        </div>

        ${it.tipo === 'RAL' ? `<div>
          <div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--sv-apagado);margin-bottom:6px;">Associações (${it.assN})</div>
          <div style="display:flex;flex-direction:column;gap:4px;">${assocHtml}</div>
        </div>` : ''}
      </div>
    `;

    gaveta.querySelector('#sv-gv-close')?.addEventListener('click', () => {
      const prevKey = st.selChave;
      st.selChave = null;
      renderTableAndDrawer(ov, st.dados || dados);
      if (prevKey) ov.querySelector(`tr[data-chave="${CSS.escape(prevKey)}"]`)?.focus({ preventScroll: true });
    });
    gaveta.querySelector('#sv-gv-copy')?.addEventListener('click', () => copiarTxt(it.num, 'Copiado: ' + it.num));
    gaveta.querySelector('#sv-gv-email')?.addEventListener('click', () => openEmailModal(it));
    gaveta.querySelector('#sv-gv-torpedo')?.addEventListener('click', () => {
      closeSirVisao();
      if (typeof openTorpedos === 'function') openTorpedos();
    });

    const saveAn = () => {
      const obj = loadJson(LS_ANALISES, {});
      obj[it.num] = {
        problema: gaveta.querySelector('#sv-an-prob')?.value || '',
        alarme: gaveta.querySelector('#sv-an-alarme')?.value || '',
        acao: gaveta.querySelector('#sv-an-acao')?.value || '',
        previsao: gaveta.querySelector('#sv-an-prev')?.value || '',
        t: Date.now()
      };
      saveJson(LS_ANALISES, obj);
      return obj[it.num];
    };
    gaveta.querySelector('#sv-an-save')?.addEventListener('click', () => { saveAn(); toastMsg('Análise salva'); });
    gaveta.querySelector('#sv-an-copy')?.addEventListener('click', () => {
      const d = saveAn();
      const txt = [
        `Ticket: ${it.num}`,
        `Designação: ${it.desig}`,
        `CF: ${it.cf}`,
        `Problema: ${d.problema || '-'}`,
        `Alarme/Critel: ${d.alarme || '-'}`,
        `Ação: ${d.acao || '-'}`,
        `Previsão: ${d.previsao || '-'}`
      ].join('\n');
      copiarTxt(txt, 'Máscara de análise copiada!');
    });
  }

  /* ── Modal E-mail de Liberação de Acesso (sem CPF/RG no repositório público) ── */
  function openEmailModal(it) {
    const bg = document.getElementById('sv-submodal-bg');
    if (!bg) return;
    const prevFocus = document.activeElement;
    let tipo = (it && it.tipo) || 'REC';
    let tecnicos = [{ nome: '', cpf: '', rg: '' }];
    const equipes = loadJson(LS_EQUIPES, []);

    const saudacao = () => {
      const h = new Date().getHours();
      return h < 12 ? 'Caros, bom dia.' : h < 18 ? 'Caros, boa tarde.' : 'Caros, boa noite.';
    };

    const fechar = () => {
      bg.hidden = true;
      try { prevFocus?.focus?.({ preventScroll: true }); } catch (e) {}
    };

    const renderEmail = () => {
      bg.hidden = false;
      bg.innerHTML = `
        <div class="sv-submodal" role="dialog" aria-modal="true" aria-label="E-mail de liberação de acesso">
          <div class="sv-submodal-hd">
            <h3>E-mail de liberação de acesso</h3>
            <button type="button" class="sv-btn-sm" id="sv-em-close" aria-label="Fechar janela de e-mail">✕</button>
          </div>
          <div class="sv-submodal-bd">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
              <div class="sv-net-switch" role="group" aria-label="Tipo de chamado">
                <button type="button" data-em-tp="REC" aria-pressed="${tipo === 'REC'}" class="${tipo === 'REC' ? 'ativo' : ''}">REC</button>
                <button type="button" data-em-tp="RAL" aria-pressed="${tipo === 'RAL'}" class="${tipo === 'RAL' ? 'ativo' : ''}">RAL</button>
              </div>
              <span style="flex:1;"></span>
              <button type="button" class="sv-btn-sm prim" id="sv-em-outlook">Abrir no Outlook Web</button>
              <button type="button" class="sv-btn-sm" id="sv-em-copy">Copiar texto</button>
            </div>
            <div class="sv-em-grid">
              <div class="sv-field full"><label for="sv-em-para">Para (destinatários)</label><input id="sv-em-para" type="text" placeholder="email1@cliente.com; email2@cliente.com"></div>
              <div class="sv-field"><label for="sv-em-tk">Número do chamado</label><input id="sv-em-tk" type="text" value="${esc(it ? it.num : '')}" placeholder="REC-123456/2026"></div>
              <div class="sv-field"><label for="sv-em-desig">Designação do Circuito</label><input id="sv-em-desig" type="text" value="${esc(it ? it.desig : '')}" placeholder="RJO/IP/25555"></div>
              <div class="sv-field full"><label for="sv-em-end">Endereço cadastrado</label><input id="sv-em-end" type="text" placeholder="Endereço completo da unidade"></div>
              <div class="sv-field full"><label for="sv-em-razao">Razão Social</label><input id="sv-em-razao" type="text" value="${esc(it && it.tipo === 'REC' ? it.ex : '')}" placeholder="CLARO SA"></div>
            </div>
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
                <strong style="font-size:12px;">Dados da equipe de fibra (salvos apenas neste aparelho)</strong>
                <div style="display:flex;gap:6px;">
                  <button type="button" class="sv-btn-sm" id="sv-em-add-tec">+ Técnico</button>
                  <button type="button" class="sv-btn-sm" id="sv-em-save-eq">Salvar equipe</button>
                </div>
              </div>
              <div id="sv-em-tecs" style="display:flex;flex-direction:column;gap:6px;"></div>
              ${equipes.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
                <span style="font-size:11.5px;color:var(--sv-apagado);align-self:center;">Equipes salvas:</span>
                ${equipes.map((eq, idx) => `<button type="button" class="sv-btn-sm" data-eq-idx="${idx}">${esc(eq.nome)}</button>`).join('')}
              </div>` : ''}
            </div>
          </div>
        </div>
      `;

      const renderTecs = () => {
        const box = bg.querySelector('#sv-em-tecs');
        if (!box) return;
        box.innerHTML = tecnicos.map((t, idx) => `
          <div class="sv-tec-row">
            <input type="text" data-ti="${idx}" data-tf="nome" value="${esc(t.nome)}" placeholder="Nome do técnico" aria-label="Nome do técnico ${idx + 1}">
            <input type="text" data-ti="${idx}" data-tf="cpf" value="${esc(t.cpf)}" placeholder="CPF" aria-label="CPF do técnico ${idx + 1}" style="font-family:var(--sv-mono);">
            <input type="text" data-ti="${idx}" data-tf="rg" value="${esc(t.rg)}" placeholder="RG" aria-label="RG do técnico ${idx + 1}" style="font-family:var(--sv-mono);">
            <button type="button" class="sv-btn-sm" data-del-ti="${idx}" aria-label="Remover técnico ${idx + 1}">✕</button>
          </div>
        `).join('');
        box.querySelectorAll('[data-ti]').forEach(inp => inp.addEventListener('input', () => {
          tecnicos[+inp.dataset.ti][inp.dataset.tf] = inp.value;
        }));
        box.querySelectorAll('[data-del-ti]').forEach(b => b.addEventListener('click', () => {
          if (tecnicos.length > 1) tecnicos.splice(+b.dataset.delTi, 1);
          else tecnicos[0] = { nome: '', cpf: '', rg: '' };
          renderTecs();
        }));
      };
      renderTecs();

      const montarEmail = () => {
        const tk = bg.querySelector('#sv-em-tk')?.value.trim() || '';
        const desig = bg.querySelector('#sv-em-desig')?.value.trim() || '';
        const end = bg.querySelector('#sv-em-end')?.value.trim() || '';
        const razao = bg.querySelector('#sv-em-razao')?.value.trim() || '';
        const para = bg.querySelector('#sv-em-para')?.value.trim() || '';
        const assunto = `LIBERAÇÃO DE ACESSO // ${tk || tipo} // ${desig || 'CIRCUITO'}${razao ? ' // ' + razao : ''}`;
        const intro = tipo === 'RAL'
          ? 'Solicitamos a liberação de acesso para nossa equipe técnica realizar manutenção emergencial de fibra óptica referente ao evento abaixo:'
          : 'Solicitamos a liberação de acesso para nossa equipe técnica realizar reparo no circuito abaixo:';
        const listaTecs = tecnicos.filter(t => t.nome.trim()).map(t =>
          `${t.nome.trim().toUpperCase()}${t.cpf.trim() ? ' - CPF: ' + t.cpf.trim() : ''}${t.rg.trim() ? ' - RG: ' + t.rg.trim() : ''}`
        ).join('\n');
        const corpo = [
          saudacao(), '', intro, '',
          `Número do chamado: ${tk}`,
          `Designação do Circuito: ${desig}`,
          `Endereço cadastrado: ${end}`,
          `Razão Social: ${razao}`, '',
          'Dados da equipe de fibra para liberação do acesso:',
          listaTecs || '(preencher técnicos)', '',
          'Atenciosamente,', 'COP REDE'
        ].join('\n');
        return { para, assunto, corpo };
      };

      bg.onclick = e => { if (e.target === bg) fechar(); };
      bg.querySelector('#sv-em-close')?.addEventListener('click', fechar);
      bg.querySelectorAll('[data-em-tp]').forEach(b => b.addEventListener('click', () => { tipo = b.dataset.emTp; renderEmail(); }));
      bg.querySelector('#sv-em-add-tec')?.addEventListener('click', () => { tecnicos.push({ nome: '', cpf: '', rg: '' }); renderTecs(); });
      bg.querySelector('#sv-em-save-eq')?.addEventListener('click', () => {
        const validos = tecnicos.filter(t => t.nome.trim());
        if (!validos.length) { toastMsg('Preencha ao menos um técnico'); return; }
        const nome = prompt('Nome para salvar esta equipe (apenas neste navegador):', validos[0].nome.split(' ')[0]);
        if (!nome) return;
        equipes.push({ nome: nome.trim(), tecnicos: validos });
        saveJson(LS_EQUIPES, equipes);
        toastMsg('Equipe salva localmente');
        renderEmail();
      });
      bg.querySelectorAll('[data-eq-idx]').forEach(b => b.addEventListener('click', () => {
        const eq = equipes[+b.dataset.eqIdx];
        if (eq && Array.isArray(eq.tecnicos)) { tecnicos = eq.tecnicos.map(t => ({ ...t })); renderTecs(); }
      }));
      bg.querySelector('#sv-em-copy')?.addEventListener('click', () => {
        const em = montarEmail();
        copiarTxt(`Assunto: ${em.assunto}\n\n${em.corpo}`, 'Texto do e-mail copiado!');
      });
      bg.querySelector('#sv-em-outlook')?.addEventListener('click', () => {
        const em = montarEmail();
        const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(em.para)}&subject=${encodeURIComponent(em.assunto)}&body=${encodeURIComponent(em.corpo)}`;
        window.open(url, '_blank', 'noopener');
      });
      setTimeout(() => bg.querySelector('#sv-em-para')?.focus({ preventScroll: true }), 20);
    };

    renderEmail();
  }

  /* ── Modal Plantão & Horários de DP ── */
  function openPlantaoModal() {
    const bg = document.getElementById('sv-submodal-bg');
    if (!bg) return;
    const prevFocus = document.activeElement;
    const hoje = new Date().toDateString();
    let pl = loadJson(LS_PLANTAO, null);
    if (!pl || pl.dia !== hoje) {
      pl = { dia: hoje, dp: [{ ini: '08:00', fim: '10:00' }], checks: [
        { txt: 'Validar fila Triagem DP', ok: false },
        { txt: 'Checar SLA vencido nas minhas áreas', ok: false },
        { txt: 'Atualizar notas sem script', ok: false }
      ] };
    }

    const fechar = () => {
      bg.hidden = true;
      try { prevFocus?.focus?.({ preventScroll: true }); } catch (e) {}
    };

    const renderPl = () => {
      bg.hidden = false;
      bg.innerHTML = `
        <div class="sv-submodal" role="dialog" aria-modal="true" aria-label="Plantão do dia">
          <div class="sv-submodal-hd">
            <h3>Plantão do dia · Horários de DP &amp; Checklist</h3>
            <button type="button" class="sv-btn-sm" id="sv-pl-close" aria-label="Fechar janela de plantão">✕</button>
          </div>
          <div class="sv-submodal-bd">
            <div>
              <strong style="font-size:12.5px;">Janelas de DP de hoje</strong>
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
                ${pl.dp.map((j, i) => `
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                    <input type="time" data-dpi="${i}" data-dpf="ini" value="${esc(j.ini)}" aria-label="Início da janela de DP ${i + 1}" style="height:36px;padding:0 8px;border-radius:8px;background:var(--sv-bg);border:1px solid var(--sv-borda);color:var(--sv-txt);">
                    <span>até</span>
                    <input type="time" data-dpi="${i}" data-dpf="fim" value="${esc(j.fim)}" aria-label="Fim da janela de DP ${i + 1}" style="height:36px;padding:0 8px;border-radius:8px;background:var(--sv-bg);border:1px solid var(--sv-borda);color:var(--sv-txt);">
                    <button type="button" class="sv-btn-sm" data-dp-del="${i}" aria-label="Remover janela de DP ${i + 1}">✕</button>
                  </div>
                `).join('')}
              </div>
              <button type="button" class="sv-btn-sm" id="sv-pl-add-dp" style="margin-top:8px;">+ Adicionar horário DP</button>
            </div>
            <div>
              <strong style="font-size:12.5px;">Checklist do plantão</strong>
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
                ${pl.checks.map((c, i) => `
                  <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
                    <input type="checkbox" data-chk="${i}" ${c.ok ? 'checked' : ''} style="accent-color:var(--sv-acento);width:18px;height:18px;">
                    <span style="${c.ok ? 'text-decoration:line-through;opacity:.65;' : ''}">${esc(c.txt)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
            <div style="display:flex;justify-content:flex-end;gap:8px;">
              <button type="button" class="sv-btn-sm prim" id="sv-pl-save">Salvar plantão</button>
            </div>
          </div>
        </div>
      `;
      bg.onclick = e => { if (e.target === bg) fechar(); };
      bg.querySelector('#sv-pl-close')?.addEventListener('click', fechar);
      bg.querySelectorAll('[data-dpi]').forEach(inp => inp.addEventListener('change', () => {
        pl.dp[+inp.dataset.dpi][inp.dataset.dpf] = inp.value;
      }));
      bg.querySelectorAll('[data-dp-del]').forEach(b => b.addEventListener('click', () => {
        pl.dp.splice(+b.dataset.dpDel, 1);
        renderPl();
      }));
      bg.querySelector('#sv-pl-add-dp')?.addEventListener('click', () => {
        pl.dp.push({ ini: '14:00', fim: '16:00' });
        renderPl();
      });
      bg.querySelectorAll('[data-chk]').forEach(chk => chk.addEventListener('change', () => {
        pl.checks[+chk.dataset.chk].ok = chk.checked;
        saveJson(LS_PLANTAO, pl);
        renderPl();
      }));
      bg.querySelector('#sv-pl-save')?.addEventListener('click', () => {
        saveJson(LS_PLANTAO, pl);
        toastMsg('Plantão salvo!');
        fechar();
      });
      setTimeout(() => bg.querySelector('#sv-pl-close')?.focus({ preventScroll: true }), 20);
    };
    renderPl();
  }

  /* Atalhos de teclado quando a Visualização SIR está ativa (e Painel Geral NÃO está por cima) */
  document.addEventListener('keydown', e => {
    if (!st.open || isPainelGeralOpen()) return;
    if (e.key === 'Escape') {
      const sub = document.getElementById('sv-submodal-bg');
      if (sub && !sub.hidden) { sub.hidden = true; return; }
      if (st.mobLat) {
        st.mobLat = false;
        document.getElementById('sv-lateral')?.classList.remove('mob-aberta');
        document.getElementById('sv-mob-areas')?.setAttribute('aria-expanded', 'false');
        syncMobileLateralInert();
        document.getElementById('sv-mob-areas')?.focus({ preventScroll: true });
        return;
      }
      if (st.selChave) {
        const prevKey = st.selChave;
        st.selChave = null;
        const ov = document.getElementById('sir-visao-overlay');
        if (ov) {
          renderTableAndDrawer(ov, st.dados || SirRegrasAE.coletarItensAtivos());
          if (prevKey) ov.querySelector(`tr[data-chave="${CSS.escape(prevKey)}"]`)?.focus({ preventScroll: true });
        }
        return;
      }
      closeSirVisao();
      return;
    }
    if (!st.loggedIn || st.tab !== 'lista') return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === '/') {
      e.preventDefault();
      document.getElementById('sv-busca-inp')?.focus();
    } else if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      openPlantaoModal();
    }
  });

  window.addEventListener('resize', syncMobileLateralInert);

  /* Atualiza automaticamente quando os dados do SIR Dashboard chegarem */
  window.addEventListener('sir:data-ready', () => {
    st.dados = SirRegrasAE.coletarItensAtivos();
    if (st.open && st.loggedIn && st.tab === 'lista') {
      const ov = document.getElementById('sir-visao-overlay');
      if (ov) {
        const cRal = ov.querySelector('#sv-cnt-ral');
        const cRec = ov.querySelector('#sv-cnt-rec');
        if (cRal) cRal.textContent = String(st.dados.RAL.length);
        if (cRec) cRec.textContent = String(st.dados.REC.length);
        renderAreasNav(ov, st.dados);
        renderTableAndDrawer(ov, st.dados);
        updateLiveIndicator();
      }
    }
  });

  window.openSirVisao = openSirVisao;
  window.closeSirVisao = closeSirVisao;
  window.openSirEmailModal = openEmailModal;
  window.getSirVisaoState = () => ({ rede: st.rede, loggedIn: st.loggedIn, usuario: st.usuario, voz: st.voz });
})();
