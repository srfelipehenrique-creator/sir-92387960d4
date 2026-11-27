/* ══════════════════════════════════════════════════════════════
   Painel Geral (2º Dashboard) — pós-login da Visualização SIR
   Reproduz fielmente os indicadores, as 3 regiões (ES / Rio A / Rio B),
   Triagem DP com relógio ao vivo e Novas Entradas, além do botão de
   retorno direto ao dashboard principal.
   ══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const LS_DP_CIENTE = 'sir_pg_dp_ciente_v1';
  const LS_VOZ = 'sir_visao_voz';

  const st = {
    open: false,
    rede: 'rede1',
    usuario: '',
    showDP: true,
    novasTab: 'TODAS',  /* 'TODAS' | 'RAL' | 'REC' */
    voz: false,
    tickTimer: null,
    lastFocus: null,
    activeModal: null,  /* { titulo, tipo, cf, grp, isQual } */
    dpCientes: new Set(),
    dpFalados: new Set()
  };

  try {
    st.voz = localStorage.getItem(LS_VOZ) === '1';
    const saved = JSON.parse(localStorage.getItem(LS_DP_CIENTE) || '[]');
    if (Array.isArray(saved)) saved.forEach(k => st.dpCientes.add(k));
  } catch (e) {}

  const esc = s => (typeof escapeHtml === 'function')
    ? escapeHtml(String(s ?? ''))
    : String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  function saveDpCientes() {
    try { localStorage.setItem(LS_DP_CIENTE, JSON.stringify([...st.dpCientes].slice(-200))); } catch (e) {}
  }

  function toastMsg(msg) {
    if (typeof showActionToast === 'function') showActionToast(msg);
  }

  function getMinhasAreas() {
    if (typeof getUserSavedAreas === 'function') {
      const a = getUserSavedAreas();
      if (Array.isArray(a) && a.length) return new Set(a);
    }
    return new Set();
  }

  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function ensureOverlay() {
    let ov = document.getElementById('painel-geral-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'painel-geral-overlay';
    ov.className = 'pg-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Painel Geral SIR');
    ov.hidden = true;
    document.body.appendChild(ov);
    return ov;
  }

  function openPainelGeral(redeId, usuario) {
    if (redeId && SirRegrasAE.SIR_REDES[redeId]) st.rede = redeId;
    if (usuario) st.usuario = usuario;
    else if (typeof getSirVisaoState === 'function') {
      const sv = getSirVisaoState();
      st.rede = sv.rede || st.rede;
      st.usuario = sv.usuario || st.usuario;
      st.voz = !!sv.voz;
    }
    if (!st.open) st.lastFocus = document.activeElement;
    st.open = true;
    const ov = ensureOverlay();
    ov.hidden = false;
    document.body.style.overflow = 'hidden';
    render('#pg-btn-voltar-main');
    startTick();
  }

  function closePainelGeral(keepSirVisaoOpen) {
    st.open = false;
    st.activeModal = null;
    stopTick();
    const ov = document.getElementById('painel-geral-overlay');
    if (ov) ov.hidden = true;
    if (!keepSirVisaoOpen) {
      if (typeof closeSirVisao === 'function') closeSirVisao();
      document.body.style.overflow = '';
      try { st.lastFocus?.focus?.({ preventScroll: true }); } catch (e) {}
    }
  }

  function startTick() {
    stopTick();
    st.tickTimer = setInterval(() => {
      if (!st.open) return;
      updateClocks();
    }, 1000);
  }
  function stopTick() {
    if (st.tickTimer) { clearInterval(st.tickTimer); st.tickTimer = null; }
  }

  function fmtMMSS(ms) {
    const seg = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateClocks() {
    const vivoEl = document.getElementById('pg-vivo-txt');
    if (vivoEl) {
      const cd = typeof countdownVal === 'number' ? countdownVal : 0;
      const m = Math.floor(cd / 60), s = String(cd % 60).padStart(2, '0');
      const last = document.getElementById('last-update')?.textContent?.replace(/^Última atualização:\s*/i, '') || '--:--:--';
      vivoEl.textContent = `${last} · próxima ${m}:${s}`;
    }
    const agora = Date.now();
    document.querySelectorAll('#painel-geral-overlay [data-dp-desde]').forEach(el => {
      const desde = Number(el.dataset.dpDesde);
      if (!desde) return;
      const diff = agora - desde;
      el.textContent = fmtMMSS(diff);
      const min = diff / 60000;
      const est = min >= 30, urg = min >= 20 && !est;
      el.classList.toggle('urgente', urg);
      el.classList.toggle('estourado', est);
      const row = el.closest('.pg-item');
      if (row) {
        row.classList.toggle('urgente', urg);
        row.classList.toggle('estourado', est);
      }
      if (st.voz && urg) {
        const tk = el.dataset.dpTk;
        if (tk && !st.dpFalados.has(tk)) {
          st.dpFalados.add(tk);
          SirRegrasAE.falar(`Atenção: ${tk} completou 20 minutos em DP`);
        }
      }
    });
  }

  /* Compatível com inbox.js: identity, typeKey, cfOrigem */
  function getNovasPendentes() {
    if (typeof appState === 'undefined' || !Array.isArray(appState.inboxItems)) return [];
    const ack = appState.acknowledgedInboxKeys || new Set();
    return appState.inboxItems
      .map(i => ({
        id: i.identity || i.key || '',
        typeKey: String(i.typeKey || i.type || 'ral').toLowerCase(),
        cf: i.cfOrigem || i.cf || '',
        ticket: i.ticket || '',
        designacao: i.designacao || '',
        extra: i.extra || '',
        item: i.item || ''
      }))
      .filter(i => i.id && !ack.has(i.id));
  }

  function render(focusSelector) {
    const ov = ensureOverlay();
    const prevScrollTop = ov.querySelector('.pg-scroll')?.scrollTop || 0;
    const dados = SirRegrasAE.coletarItensAtivos();
    const agora = Date.now();
    const minhas = getMinhasAreas();

    const ralTotal = dados.RAL.length;
    const recTotal = dados.REC.length;
    const ralVenc = dados.RAL.filter(i => SirRegrasAE.nivelSLA(SirRegrasAE.slaRestante(i, agora), 'RAL') === 2).length;
    const recVenc = dados.REC.filter(i => SirRegrasAE.nivelSLA(SirRegrasAE.slaRestante(i, agora), 'REC') === 2).length;

    /* Triagem DP: sem técnico e não marcados como ciente */
    const dpSemTec = dados.DP.filter(d => !d.tec);
    const dpAtivos = dpSemTec.filter(d => !st.dpCientes.has(d.chave));
    const dpPorLocal = {};
    dpAtivos.forEach(d => { dpPorLocal[d.cf] = (dpPorLocal[d.cf] || 0) + 1; });

    /* Novas entradas (sincronizadas com inbox do dashboard) */
    const novasAll = getNovasPendentes();
    const novasRal = novasAll.filter(i => i.typeKey === 'ral');
    const novasRec = novasAll.filter(i => i.typeKey === 'rec');
    const novasVisiveis = st.novasTab === 'RAL' ? novasRal : st.novasTab === 'REC' ? novasRec : novasAll;
    const novasPorCfTipo = new Set(novasAll.map(i => `${i.typeKey.toUpperCase()}|${i.cf}`));

    const rede = SirRegrasAE.SIR_REDES[st.rede] || SirRegrasAE.SIR_REDES.rede1;

    const regioesHtml = SirRegrasAE.GRUPOS.map(g => {
      const cfsCod = new Set(g.regioes.map(r => r.cod));
      const regRal = dados.RAL.filter(i => cfsCod.has(i.cod));
      const regRec = dados.REC.filter(i => cfsCod.has(i.cod));
      const linhas = g.regioes.map(r => {
        const nRal = dados.RAL.filter(i => i.cod === r.cod).length;
        const nRec = dados.REC.filter(i => i.cod === r.cod).length;
        const isMinha = minhas.has(r.cod);
        const novoRal = novasPorCfTipo.has('RAL|' + r.cod);
        const novoRec = novasPorCfTipo.has('REC|' + r.cod);
        return `
          <div class="pg-r-lin ${isMinha ? 'minha' : ''}">
            <div class="pg-cf-info" title="${esc(r.nome)}">
              <b>${esc(r.cod)}</b>
              <small>${esc(r.nome)}</small>
            </div>
            <button type="button" class="pg-qtd ${SirRegrasAE.corVolumeCF(nRal)}" data-open-list="RAL" data-cf="${esc(r.cod)}" aria-label="RAL em ${esc(r.cod)}: ${nRal}${novoRal ? ' (nova entrada)' : ''}" title="Abrir RALs de ${esc(r.cod)}">
              ${nRal}${novoRal ? '<span class="pg-qtd-novo" aria-hidden="true"></span><span class="sv-sr-only">Nova entrada</span>' : ''}
            </button>
            <button type="button" class="pg-qtd ${SirRegrasAE.corVolumeCF(nRec)}" data-open-list="REC" data-cf="${esc(r.cod)}" aria-label="REC em ${esc(r.cod)}: ${nRec}${novoRec ? ' (nova entrada)' : ''}" title="Abrir RECs de ${esc(r.cod)}">
              ${nRec}${novoRec ? '<span class="pg-qtd-novo" aria-hidden="true"></span><span class="sv-sr-only">Nova entrada</span>' : ''}
            </button>
          </div>
        `;
      }).join('');

      return `
        <section class="pg-regiao" aria-label="${esc(g.nome)}">
          <div class="pg-r-cab">
            <h2>${esc(g.nome)}</h2>
            <button type="button" class="pg-qtd total ${SirRegrasAE.corVolumeTotal(regRal.length)}" data-open-list="RAL" data-grp="${esc(g.cod)}" aria-label="Total RAL ${esc(g.nome)}: ${regRal.length}" title="Todas as RALs de ${esc(g.nome)}">${regRal.length}</button>
            <button type="button" class="pg-qtd total ${SirRegrasAE.corVolumeTotal(regRec.length)}" data-open-list="REC" data-grp="${esc(g.cod)}" aria-label="Total REC ${esc(g.nome)}: ${regRec.length}" title="Todas as RECs de ${esc(g.nome)}">${regRec.length}</button>
          </div>
          <div class="pg-r-tit"><span>CF</span><span>RAL</span><span>REC</span></div>
          ${linhas}
        </section>
      `;
    }).join('');

    const dpItensHtml = dpAtivos.length
      ? dpAtivos.map(d => {
          const desde = d.cfDesde || d.ab || agora;
          const diff = agora - desde;
          const min = diff / 60000;
          const cls = min >= 30 ? 'estourado' : min >= 20 ? 'urgente' : '';
          const urlTk = SirRegrasAE.urlDoTicket(d, st.rede);
          return `
            <div class="pg-item ${cls}" data-tipo="${esc(d.tipo)}">
              <div class="pg-item-l1">
                <span class="pg-tipo ${esc(d.tipo)}">${esc(d.tipo)}</span>
                <span class="pg-dp-chip">${esc(d.cf)}</span>
                <a class="sv-tk-link" href="${esc(urlTk)}" target="_blank" rel="noopener">${esc(d.num)}</a>
                <span class="pg-relogio ${cls}" data-dp-desde="${desde}" data-dp-tk="${esc(d.num)}">${fmtMMSS(diff)}</span>
              </div>
              <div class="pg-item-l2" title="${esc(d.desig)} · ${esc(d.ex)}">${esc(d.desig)}${d.ex && d.ex !== 'N/D' ? ' · ' + esc(d.ex) : ''}</div>
              <button type="button" class="pg-ciente" data-dp-ack="${esc(d.chave)}" title="Marcar como ciente" aria-label="Ciente em ${esc(d.num)}"><span aria-hidden="true">✓</span></button>
            </div>
          `;
        }).join('')
      : `<div class="pg-vazio">Nenhum ticket aguardando Triagem DP.</div>`;

    const novasItensHtml = novasVisiveis.length
      ? novasVisiveis.map(n => {
          const tipo = n.typeKey.toUpperCase();
          const urlTk = SirRegrasAE.urlDoTicket({ num: n.ticket, desig: n.designacao, item: n.item }, st.rede);
          return `
            <div class="pg-item" data-tipo="${esc(tipo)}">
              <div class="pg-item-l1">
                <span class="pg-tipo ${esc(tipo)}">${esc(tipo)}</span>
                ${n.cf ? `<span class="sv-cf-pill">${esc(n.cf)}</span>` : ''}
                <a class="sv-tk-link" href="${esc(urlTk)}" target="_blank" rel="noopener">${esc(n.ticket)}</a>
              </div>
              <div class="pg-item-l2" title="${esc(n.designacao || '')}">${esc(n.designacao || '—')}${n.extra ? ' · ' + esc(n.extra) : ''}</div>
              <button type="button" class="pg-ciente" data-nova-ack="${esc(n.id)}" title="Marcar como ciente" aria-label="Ciente em ${esc(n.ticket)}"><span aria-hidden="true">✓</span></button>
            </div>
          `;
        }).join('')
      : `<div class="pg-vazio">Nada novo nas suas áreas. Quando uma RAL ou REC entrar num CF seu, ela aparece aqui.</div>`;

    ov.innerHTML = `
      <header class="pg-topo">
        <button type="button" class="pg-btn voltar-main" id="pg-btn-voltar-main" title="Retornar ao dashboard principal">
          <span aria-hidden="true">←</span> Dashboard principal
        </button>
        <button type="button" class="pg-btn" id="pg-btn-voltar-sir" title="Voltar para a Lista SIR (Visual Novo)">
          Lista SIR (${esc(rede.nome)})
        </button>

        <div class="pg-marca">
          <div class="pg-marca-ico" aria-hidden="true">SIR</div>
          <h1>Painel Geral</h1>
        </div>

        <div class="pg-vivo" title="Status da coleta ao vivo">
          <i aria-hidden="true"></i>
          <b>Ao vivo</b>
          <span id="pg-vivo-txt">Sincronizado</span>
        </div>

        <div class="pg-espaco"></div>

        <div class="pg-acoes">
          <button type="button" class="pg-btn ico ${st.showDP ? 'ativo' : ''}" id="pg-toggle-dp" aria-pressed="${st.showDP}" title="Mostrar/ocultar Triagem DP" aria-label="Mostrar ou ocultar Triagem DP"><span aria-hidden="true">🚨</span></button>
          <button type="button" class="pg-btn ico" id="pg-btn-qual" title="RALs de Qualidade (${dados.QUAL.length})" aria-label="RALs de Qualidade (${dados.QUAL.length})"><span aria-hidden="true">📋</span></button>
          <button type="button" class="pg-btn ico" id="pg-btn-areas" title="Minhas áreas" aria-label="Minhas áreas"><span aria-hidden="true">📍</span></button>
          <button type="button" class="pg-btn ico" id="pg-btn-critel" title="Verificar designações no Critel" aria-label="Verificar designações no Critel"><span aria-hidden="true">📈</span></button>
          <button type="button" class="pg-btn ico" id="pg-btn-email" title="E-mail de liberação de acesso" aria-label="E-mail de liberação"><span aria-hidden="true">✉</span></button>
          <button type="button" class="pg-btn ico ${st.voz ? 'ativo' : ''}" id="pg-btn-voz" aria-pressed="${st.voz}" title="Anúncio por voz" aria-label="Anúncio por voz"><span aria-hidden="true">${st.voz ? '🔊' : '🔇'}</span></button>
          <span class="pg-sep" aria-hidden="true"></span>
          <button type="button" class="pg-btn ico" id="pg-btn-fs" title="Tela cheia" aria-label="Alternar tela cheia"><span aria-hidden="true">⛶</span></button>
          <button type="button" class="pg-btn prim" id="pg-btn-atualizar"><span aria-hidden="true">↻ </span>Atualizar</button>
        </div>
      </header>

      <div class="pg-scroll">
        <div class="pg-corpo">
          <div class="pg-principal">
            <div class="pg-kpis">
              <button type="button" class="pg-kpi k-ral" data-open-list="RAL" data-cf="ALL">
                <span class="pg-kpi-rot">RAL EM TELA</span>
                <span class="pg-kpi-n ${SirRegrasAE.corVolumeTotal(ralTotal)}">${ralTotal}</span>
                <span class="pg-kpi-sub ${ralVenc ? 'alerta' : ''}">${ralVenc ? `${ralVenc} com SLA vencido` : 'Todos dentro do SLA'}</span>
              </button>

              <button type="button" class="pg-kpi k-rec" data-open-list="REC" data-cf="ALL">
                <span class="pg-kpi-rot">REC EM TELA</span>
                <span class="pg-kpi-n ${SirRegrasAE.corVolumeTotal(recTotal)}">${recTotal}</span>
                <span class="pg-kpi-sub ${recVenc ? 'alerta' : ''}">${recVenc ? `${recVenc} com SLA vencido` : 'Todos dentro do SLA'}</span>
              </button>

              <button type="button" class="pg-kpi k-dp ${dpAtivos.length ? 'tem' : ''}" id="pg-kpi-dp">
                <span class="pg-kpi-rot">EM DP</span>
                <span class="pg-kpi-n">${dpAtivos.length}</span>
                <span class="pg-kpi-sub">na Triagem DP, à direita</span>
              </button>

              <button type="button" class="pg-kpi k-novas ${novasAll.length ? 'tem' : ''}" id="pg-kpi-novas">
                <span class="pg-kpi-rot">NOVAS ENTRADAS</span>
                <span class="pg-kpi-n">${novasAll.length}</span>
                <span class="pg-kpi-sub">nas suas áreas, na fila à direita</span>
              </button>
            </div>

            <div class="pg-regioes">${regioesHtml}</div>
          </div>

          <aside class="pg-fila" aria-label="Filas prioritárias">
            ${st.showDP ? `
              <section class="pg-box dp-box ${dpAtivos.length ? 'tem' : ''}" id="pg-box-dp">
                <div class="pg-box-hd">
                  <h3><span aria-hidden="true">🚨 </span>Triagem DP <span class="pg-selo">${dpAtivos.length}</span></h3>
                  <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;">
                    ${Object.entries(dpPorLocal).map(([k, v]) => `<span class="pg-dp-chip">${esc(k)} <b>${v}</b></span>`).join('')}
                  </div>
                </div>
                <div class="pg-lista">${dpItensHtml}</div>
                <div class="pg-rodape-nota">Duração em DP · urgente aos 20 min (a voz avisa) · estourado aos 30. ${dpSemTec.length < dados.DP.length ? `${dados.DP.length - dpSemTec.length} em DP com técnico ficam de fora.` : 'Tickets em DP com técnico ficam de fora.'}</div>
              </section>
            ` : ''}

            <section class="pg-box novas-box ${novasAll.length ? 'tem' : ''}" id="pg-box-novas">
              <div class="pg-box-hd">
                <h3><span aria-hidden="true">📥 </span>Novas entradas <span class="pg-selo">${novasAll.length}</span></h3>
                ${novasAll.length ? `<button type="button" class="pg-btn" id="pg-ack-all-novas" style="margin-left:auto;min-height:30px;font-size:11.5px;padding:0 10px;">Ciente em tudo</button>` : ''}
              </div>
              <div class="pg-tabs" role="tablist" aria-label="Filtrar novas entradas por tipo">
                <button type="button" role="tab" aria-selected="${st.novasTab === 'TODAS'}" data-ntab="TODAS" class="${st.novasTab === 'TODAS' ? 'ativo' : ''}">Todas ${novasAll.length}</button>
                <button type="button" role="tab" aria-selected="${st.novasTab === 'RAL'}" data-ntab="RAL" class="${st.novasTab === 'RAL' ? 'ativo' : ''}">RAL ${novasRal.length}</button>
                <button type="button" role="tab" aria-selected="${st.novasTab === 'REC'}" data-ntab="REC" class="${st.novasTab === 'REC' ? 'ativo' : ''}">REC ${novasRec.length}</button>
              </div>
              <div class="pg-lista">${novasItensHtml}</div>
            </section>
          </aside>
        </div>
      </div>

      <div class="pg-modal-bg" id="pg-modal-bg" hidden></div>
    `;

    const sc = ov.querySelector('.pg-scroll');
    if (sc && prevScrollTop) sc.scrollTop = prevScrollTop;

    bindEvents(ov, dados);
    updateClocks();

    /* Preserva modal de tickets aberto caso um sir:data-ready re-renderize a tela */
    if (st.activeModal) {
      renderActiveModal(dados, false);
    }

    if (focusSelector) {
      setTimeout(() => ov.querySelector(focusSelector)?.focus({ preventScroll: true }), 20);
    }
  }

  function resolveModalItems(dados, spec) {
    if (spec.isQual) return dados.QUAL;
    let lista = dados[spec.tipo] || [];
    if (spec.cf && spec.cf !== 'ALL') lista = lista.filter(i => i.cod === spec.cf);
    else if (spec.grp) {
      const g = SirRegrasAE.GRUPOS.find(x => x.cod === spec.grp);
      const cfs = new Set(g ? g.regioes.map(r => r.cod) : []);
      lista = lista.filter(i => cfs.has(i.cod));
    }
    return lista;
  }

  function bindEvents(ov, dados) {
    ov.querySelector('#pg-btn-voltar-main')?.addEventListener('click', () => closePainelGeral(false));
    ov.querySelector('#pg-btn-voltar-sir')?.addEventListener('click', () => {
      closePainelGeral(true);
      if (typeof openSirVisao === 'function') openSirVisao(st.rede);
    });
    ov.querySelector('#pg-toggle-dp')?.addEventListener('click', () => {
      st.showDP = !st.showDP;
      render('#pg-toggle-dp');
    });
    ov.querySelector('#pg-btn-qual')?.addEventListener('click', () => {
      st.activeModal = { titulo: 'RALs de Qualidade', tipo: 'RAL', isQual: true, trigger: '#pg-btn-qual' };
      renderActiveModal(dados, true);
    });
    ov.querySelector('#pg-btn-areas')?.addEventListener('click', () => {
      if (typeof openSettings === 'function') openSettings();
    });
    ov.querySelector('#pg-btn-critel')?.addEventListener('click', () => {
      const ds = [...dados.RAL, ...dados.REC].map(i => SirRegrasAE.designacaoCritel(i.desig)).filter(Boolean);
      const unicas = [...new Set(ds)].slice(0, 30);
      if (!unicas.length) { toastMsg('Nenhuma designação válida para o Critel'); return; }
      window.open(SirRegrasAE.urlCritel(unicas), '_blank', 'noopener');
    });
    ov.querySelector('#pg-btn-email')?.addEventListener('click', () => {
      closePainelGeral(true);
      if (typeof openSirVisao === 'function') openSirVisao(st.rede);
      if (typeof openSirEmailModal === 'function') openSirEmailModal(null);
    });
    ov.querySelector('#pg-btn-voz')?.addEventListener('click', () => {
      st.voz = !st.voz;
      try { localStorage.setItem(LS_VOZ, st.voz ? '1' : '0'); } catch (e) {}
      if (st.voz) SirRegrasAE.falar('Anúncio por voz ativado no Painel Geral');
      render('#pg-btn-voz');
    });
    ov.querySelector('#pg-btn-fs')?.addEventListener('click', () => {
      try {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      } catch (e) {}
    });
    ov.querySelector('#pg-btn-atualizar')?.addEventListener('click', () => {
      if (typeof loadNow === 'function') { loadNow(); toastMsg('Atualizando Painel Geral…'); }
    });
    const scrollBehavior = () => prefersReducedMotion() ? 'auto' : 'smooth';
    ov.querySelector('#pg-kpi-dp')?.addEventListener('click', () => {
      if (!st.showDP) { st.showDP = true; render(); }
      document.getElementById('pg-box-dp')?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
    });
    ov.querySelector('#pg-kpi-novas')?.addEventListener('click', () => {
      document.getElementById('pg-box-novas')?.scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
    });

    ov.querySelectorAll('[data-open-list]').forEach(btn => btn.addEventListener('click', () => {
      const tipo = btn.dataset.openList;
      const cf = btn.dataset.cf;
      const grp = btn.dataset.grp;
      let titulo = `${tipo} · Total em tela`;
      if (cf && cf !== 'ALL') titulo = `${tipo} · ${cf} (${SirRegrasAE.NOMES[cf] || cf})`;
      else if (grp) {
        const g = SirRegrasAE.GRUPOS.find(x => x.cod === grp);
        titulo = `${tipo} · ${g ? g.nome : grp}`;
      }
      st.activeModal = { titulo, tipo, cf, grp, isQual: false, triggerEl: btn };
      renderActiveModal(dados, true);
    }));

    ov.querySelectorAll('[data-dp-ack]').forEach(btn => btn.addEventListener('click', () => {
      st.dpCientes.add(btn.dataset.dpAck);
      saveDpCientes();
      render();
    }));

    ov.querySelectorAll('[data-ntab]').forEach(btn => btn.addEventListener('click', () => {
      st.novasTab = btn.dataset.ntab;
      render(`[data-ntab="${st.novasTab}"]`);
    }));

    ov.querySelectorAll('[data-nova-ack]').forEach(btn => btn.addEventListener('click', () => {
      if (typeof acknowledgeInboxItem === 'function') acknowledgeInboxItem(btn.dataset.novaAck);
      else if (typeof appState !== 'undefined' && appState.acknowledgedInboxKeys) {
        appState.acknowledgedInboxKeys.add(btn.dataset.novaAck);
        if (typeof saveInboxState === 'function') saveInboxState();
      }
      render();
    }));

    ov.querySelector('#pg-ack-all-novas')?.addEventListener('click', () => {
      if (typeof acknowledgeAllInboxItems === 'function') acknowledgeAllInboxItems();
      render();
    });
  }

  function closeTicketsModal() {
    const bg = document.getElementById('pg-modal-bg');
    const prev = st.activeModal;
    st.activeModal = null;
    if (bg) bg.hidden = true;
    if (prev?.trigger) document.querySelector(prev.trigger)?.focus({ preventScroll: true });
    else if (prev?.triggerEl && document.contains(prev.triggerEl)) prev.triggerEl.focus({ preventScroll: true });
  }

  function renderActiveModal(dados, moveFocus) {
    const bg = document.getElementById('pg-modal-bg');
    const spec = st.activeModal;
    if (!bg || !spec) return;
    const itens = resolveModalItems(dados, spec);
    const agora = Date.now();
    bg.hidden = false;
    const rows = itens.length
      ? itens.map(it => {
          const slaMin = SirRegrasAE.slaRestante(it, agora);
          const niv = SirRegrasAE.nivelSLA(slaMin, it.tipo);
          const urlTk = SirRegrasAE.urlDoTicket(it, st.rede);
          const dCritel = SirRegrasAE.designacaoCritel(it.desig);
          return `<tr data-tipo="${esc(it.tipo)}">
            <td><span class="sv-cf-pill">${esc(it.cf)}</span></td>
            <td><a class="sv-tk-link" href="${esc(urlTk)}" target="_blank" rel="noopener">${esc(it.num)}</a></td>
            <td>${dCritel ? `<a class="sv-desig-link" href="${esc(SirRegrasAE.urlCritel(dCritel))}" target="_blank" rel="noopener">${esc(it.desig)}</a>` : esc(it.desig)}</td>
            <td>${esc(it.ex)}</td>
            <td style="font-family:var(--pg-mono);font-size:11.5px;">${esc(it.abertura || '—')}</td>
            <td><span class="sv-sla ${niv != null ? 'n' + niv : ''}">${esc(SirRegrasAE.formatSlaPill(slaMin))}</span></td>
            <td><span class="sv-st ${esc(it.st)}">${esc(it.sr)}</span></td>
            <td>${esc(it.tec || '—')}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--pg-apagado);">Nenhum ticket nesta seleção.</td></tr>`;

    bg.innerHTML = `
      <div class="pg-modal" role="dialog" aria-modal="true" aria-label="${esc(spec.titulo)}">
        <div class="pg-modal-hd">
          <h3>${esc(spec.titulo)} (${itens.length})</h3>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="pg-btn" id="pg-m-critel">Critel</button>
            <button type="button" class="pg-btn" id="pg-m-copy">Copiar desig.</button>
            <button type="button" class="pg-btn" id="pg-m-csv">CSV ↓</button>
            <button type="button" class="pg-btn" id="pg-m-close" aria-label="Fechar lista de tickets">✕</button>
          </div>
        </div>
        <div class="pg-modal-bd">
          <table class="sv-table">
            <thead>
              <tr>
                <th scope="col" style="padding:9px 10px;">CF</th>
                <th scope="col" style="padding:9px 10px;">Ticket</th>
                <th scope="col" style="padding:9px 10px;">Designação</th>
                <th scope="col" style="padding:9px 10px;">${spec.tipo === 'RAL' ? 'Tipo RAL' : 'Cliente'}</th>
                <th scope="col" style="padding:9px 10px;">Abertura</th>
                <th scope="col" style="padding:9px 10px;">SLA</th>
                <th scope="col" style="padding:9px 10px;">Status</th>
                <th scope="col" style="padding:9px 10px;">Técn.</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    bg.onclick = e => { if (e.target === bg) closeTicketsModal(); };
    bg.querySelector('#pg-m-close')?.addEventListener('click', closeTicketsModal);
    bg.querySelector('#pg-m-critel')?.addEventListener('click', () => {
      const ds = [...new Set(itens.map(i => SirRegrasAE.designacaoCritel(i.desig)).filter(Boolean))].slice(0, 30);
      if (!ds.length) { toastMsg('Nenhuma designação de Critel'); return; }
      window.open(SirRegrasAE.urlCritel(ds), '_blank', 'noopener');
    });
    bg.querySelector('#pg-m-copy')?.addEventListener('click', () => {
      const ds = [...new Set(itens.map(i => i.desig).filter(d => d && d !== 'N/D'))];
      if (!ds.length) { toastMsg('Nenhuma designação para copiar'); return; }
      navigator.clipboard?.writeText(ds.join('\n')).then(() => toastMsg(`${ds.length} designação(ões) copiada(s)`));
    });
    bg.querySelector('#pg-m-csv')?.addEventListener('click', () => {
      const header = 'CF;Ticket;Designacao;Detalhe;Abertura;Status;Tecnico\n';
      const body = itens.map(i => [i.cf, i.num, i.desig, i.ex, i.abertura, i.sr, i.tec].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(';')).join('\n');
      const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `painel-geral-${spec.tipo.toLowerCase()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    if (moveFocus) setTimeout(() => bg.querySelector('#pg-m-close')?.focus({ preventScroll: true }), 20);
  }

  document.addEventListener('keydown', e => {
    if (!st.open) return;
    if (e.key === 'Escape') {
      const settingsOpen = document.getElementById('settings-modal')?.classList.contains('open');
      if (settingsOpen) return;
      if (st.activeModal) { closeTicketsModal(); return; }
      closePainelGeral(false);
    }
  });

  window.addEventListener('sir:data-ready', () => {
    if (st.open) render();
  });

  window.openPainelGeral = openPainelGeral;
  window.closePainelGeral = closePainelGeral;
})();
