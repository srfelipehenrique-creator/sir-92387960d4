/* ══════════════════════════════════════════════════════════════
   Visual Netflix (v93) — Hero Billboard ao vivo + atalhos rápidos
   Só aparece com a chave "Visual Netflix" ligada (css/rec-netflix.css).
   - Não altera nem substitui nenhuma função existente do painel:
     apenas lê modalData / getUserSavedAreas / calcSla e chama os
     próprios handlers reais (openModal, openTorpedos, openMascaras…).
   - Atualiza a cada renderização do painel e troca de escopo.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const ligado = () => typeof SirRecursos === 'undefined' || SirRecursos.ativo('netflix');

  function esc(s) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(s)
      : String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function calcularResumo() {
    const areas = typeof getUserSavedAreas === 'function' ? getUserSavedAreas() : [];
    const hasMine = Array.isArray(areas) && areas.length > 0;
    const scope = hasMine && typeof getV2Scope === 'function' ? getV2Scope() : 'all';
    const baseKey = scope === 'mine' ? 'MY_AREAS_V2' : 'ALL';

    const ralList = (typeof modalData !== 'undefined' && modalData && modalData.ral && modalData.ral[baseKey]) || [];
    const recList = (typeof modalData !== 'undefined' && modalData && modalData.rec && modalData.rec[baseKey]) || [];
    const qualList = (typeof modalData !== 'undefined' && modalData && modalData.ral && modalData.ral['Q:' + baseKey]) || [];

    let totalSla = 0, noPrazo = 0, vence30 = 0, fora = 0;
    const contar = (list, isRal) => {
      if (typeof calcSla !== 'function') return;
      for (const it of list) {
        const s = calcSla(it.abertura, isRal);
        if (!s) continue;
        totalSla++;
        if (s.remaining > 0) {
          noPrazo++;
          if (s.remaining <= 30 * 60000) vence30++;
        } else {
          fora++;
        }
      }
    };
    contar(ralList, true);
    contar(recList, false);

    /* Ranking "Em alta agora": CFs com mais tickets abertos no escopo atual */
    const porCf = [];
    if (typeof REGIONS !== 'undefined' && typeof modalData !== 'undefined' && modalData) {
      for (const cfs of Object.values(REGIONS)) {
        for (const cf of Object.keys(cfs)) {
          if (scope === 'mine' && !areas.includes(cf)) continue;
          const r = (modalData.ral && modalData.ral[cf] || []).length;
          const c = (modalData.rec && modalData.rec[cf] || []).length;
          if (r + c > 0) {
            porCf.push({
              cf,
              nome: (typeof CF_NAMES !== 'undefined' && CF_NAMES[cf]) || '',
              ral: r,
              rec: c,
              total: r + c,
              crit: r >= 10 || c >= 10
            });
          }
        }
      }
    }
    porCf.sort((a, b) => (b.crit - a.crit) || (b.ral - a.ral) || (b.total - a.total));

    const novas = parseInt((document.getElementById('inbox-count') || {}).textContent, 10) || 0;
    const pct = totalSla > 0 ? Math.round((noPrazo / totalSla) * 100) : 100;

    return {
      scope, baseKey,
      ral: ralList.length, rec: recList.length, qual: qualList.length,
      totalSla, pct, vence30, fora, novas,
      top: porCf.slice(0, 3)
    };
  }

  function garantirHero() {
    let el = document.getElementById('nf-hero');
    if (el) return el;
    const col = document.querySelector('.v2-dash-col');
    const grid = document.getElementById('main-grid');
    if (!col || !grid) return null;
    el = document.createElement('section');
    el.id = 'nf-hero';
    el.className = 'nf-hero';
    el.setAttribute('aria-label', 'Destaque operacional ao vivo');
    col.insertBefore(el, grid);

    /* Delegação única de cliques no Hero (sem duplicar ouvintes a cada atualização) */
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-nf-act]');
      if (!btn) return;
      const act = btn.dataset.nfAct;
      try {
        if (act === 'open-modal') {
          const key = btn.dataset.nfKey || 'ALL';
          const isRal = btn.dataset.nfRal !== '0';
          const title = btn.dataset.nfTitle || 'Chamados';
          if (typeof openModal === 'function') openModal(key, isRal, title);
        } else if (act === 'enderecos' && typeof openNodes === 'function') openNodes();
        else if (act === 'torpedos' && typeof openTorpedos === 'function') openTorpedos();
        else if (act === 'mascaras' && typeof openMascaras === 'function') openMascaras();
        else if (act === 'scripts' && typeof openScripts === 'function') openScripts();
        else if (act === 'siglas' && typeof openSiglas === 'function') openSiglas();
        else if (act === 'areas' && typeof openSettings === 'function') openSettings();
        else if (act === 'inbox') {
          const sec = document.getElementById('inbox-section');
          if (sec) {
            if (sec.classList.contains('inbox-collapsed') && typeof toggleInboxBody === 'function') toggleInboxBody(true);
            sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        else if (act === 'buscar') {
          const cmdBtn = document.getElementById('btn-cmd');
          if (cmdBtn) cmdBtn.click();
          else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        }
        else if (act === 'clima' && typeof SirClima !== 'undefined') {
          SirClima.atualizar();
        }
      } catch (err) { console.warn('netflix act', err); }
    });
    return el;
  }

  function renderHero() {
    const existing = document.getElementById('nf-hero');
    if (!ligado()) {
      if (existing) existing.hidden = true;
      return;
    }
    const el = garantirHero();
    if (!el) return;
    el.hidden = false;

    const d = calcularResumo();
    const critico = d.top[0] && d.top[0].crit;
    el.classList.toggle('nf-hero-crit', !!(critico || d.fora > 0));

    const escopoLbl = d.scope === 'mine' ? 'MINHAS ÁREAS' : 'TODAS AS ÁREAS';
    const titulo = critico
      ? `Destaque crítico: ${d.top[0].cf} · ${d.top[0].ral} RAL e ${d.top[0].rec} REC`
      : (d.ral + d.rec > 0
          ? `${d.ral} RAL · ${d.rec} REC em tela`
          : 'Operação estável · nenhum chamado aberto');

    const sub = critico
      ? `${d.top[0].nome ? d.top[0].nome + ' — ' : ''}${d.ral} RAL e ${d.rec} REC no total (${escopoLbl.toLowerCase()}).`
      : `Acompanhamento em tempo real do COP REDE Fibra RJ/ES (${escopoLbl.toLowerCase()}).`;

    const matchCls = d.pct < 75 ? 'crit' : d.pct < 90 ? 'warn' : '';
    const matchTxt = d.totalSla > 0 ? `${d.pct}% no prazo` : 'Sem prazo ativo';

    /* Botão principal: abre a área crítica ou a lista principal do escopo */
    const playKey = critico ? d.top[0].cf : d.baseKey;
    const playIsRal = critico ? (d.top[0].ral >= d.top[0].rec) : (d.ral > 0 || d.rec === 0);
    const playTitle = critico
      ? (typeof listTitle === 'function' ? listTitle(playIsRal ? 'ral' : 'rec', playKey) : `${playIsRal ? 'RAL' : 'REC'} · ${playKey}`)
      : (typeof listTitle === 'function' ? listTitle(playIsRal ? 'ral' : 'rec', playKey) : `${playIsRal ? 'RAL' : 'REC'} · ${escopoLbl}`);
    const playLabel = critico ? `Abrir ${d.top[0].cf}` : `Ver ${playIsRal ? 'RAL' : 'REC'}`;

    const topHTML = d.top.length
      ? d.top.map((item, idx) => {
          const isRal = item.ral >= item.rec;
          const tit = typeof listTitle === 'function'
            ? listTitle(isRal ? 'ral' : 'rec', item.cf)
            : `${isRal ? 'RAL' : 'REC'} · ${item.cf}`;
          return `<button type="button" class="nf-top-item" data-nf-act="open-modal" data-nf-key="${esc(item.cf)}" data-nf-ral="${isRal ? '1' : '0'}" data-nf-title="${esc(tit)}" title="Abrir tickets de ${esc(item.cf)}">
            <span class="nf-top-rank" aria-hidden="true">${idx + 1}</span>
            <span class="nf-top-info">
              <span class="nf-top-cf">${esc(item.cf)}</span>
              <span class="nf-top-name">${esc(item.nome || 'Centro de Fusão')}</span>
            </span>
            <span class="nf-top-nums"><span class="${item.ral >= 10 ? 'crit' : ''}">${item.ral}</span>/<span class="${item.rec >= 10 ? 'crit' : ''}">${item.rec}</span></span>
          </button>`;
        }).join('')
      : '<div class="nf-top-empty">Nenhuma área com tickets no momento.</div>';

    const climaHTML = typeof SirClima !== 'undefined' ? SirClima.renderPillHTML() : '';

    el.innerHTML = `
      <div class="nf-hero-main">
        <div class="nf-eyebrow">
          <span class="nf-n-mark" aria-hidden="true">S</span>
          <span>COP REDE FIBRA · ${esc(escopoLbl)}</span>
          <span class="nf-live-pill">AO VIVO</span>
          <span id="nf-clima-slot" class="nf-clima-slot">${climaHTML}</span>
        </div>
        <h2 class="nf-hero-title">${esc(titulo)}</h2>
        <p class="nf-hero-sub">${esc(sub)}</p>
        <div class="nf-hero-meta">
          <span class="nf-match ${matchCls}">${esc(matchTxt)}</span>
          <span class="nf-tag">RAL 6H</span>
          <span class="nf-tag">REC 4H</span>
          ${d.qual > 0 ? `<span class="nf-tag">${d.qual} QUAL</span>` : ''}
          ${d.vence30 > 0 ? `<span class="nf-tag warn">${d.vence30} vencem &lt; 30m</span>` : ''}
          ${d.fora > 0 ? `<span class="nf-tag crit">${d.fora} fora do prazo</span>` : ''}
          ${d.novas > 0 ? `<button type="button" class="nf-tag crit" data-nf-act="inbox" title="Abrir Novas Entradas">${d.novas} nova${d.novas > 1 ? 's' : ''}</button>` : ''}
        </div>
        <div class="nf-hero-actions">
          <div class="nf-hero-primary">
            <button type="button" class="nf-btn-play" data-nf-act="open-modal" data-nf-key="${esc(playKey)}" data-nf-ral="${playIsRal ? '1' : '0'}" data-nf-title="${esc(playTitle)}">
              <span aria-hidden="true">▶</span> ${esc(playLabel)}
            </button>
            <button type="button" class="nf-btn-info" data-nf-act="enderecos" title="Endereços de node (o mesmo do menu)">
              <span aria-hidden="true">📍</span> Endereços
            </button>
          </div>
          <div class="nf-hero-chips" aria-label="Atalhos rápidos">
            <button type="button" class="nf-chip" data-nf-act="areas">Minhas Áreas</button>
            <button type="button" class="nf-chip" data-nf-act="buscar">Buscar</button>
          </div>
        </div>
      </div>
      <div class="nf-hero-top" aria-label="Áreas com mais chamados agora">
        <div class="nf-top-hd"><span>Em alta agora</span><b>TOP ${Math.max(1, d.top.length)}</b></div>
        <div class="nf-top-list">${topHTML}</div>
      </div>`;
  }

  /* ── Carrossel horizontal estilo Netflix no computador (v95) ── */
  function atualizarSetas(body, tiles) {
    const prev = body.querySelector(':scope > .nf-rail-prev');
    const next = body.querySelector(':scope > .nf-rail-next');
    if (!prev || !next) return;
    if (!ligado() || window.innerWidth <= 640) {
      prev.hidden = true; next.hidden = true;
      return;
    }
    const max = tiles.scrollWidth - tiles.clientWidth;
    prev.hidden = !(max > 4 && tiles.scrollLeft > 4);
    next.hidden = !(max > 4 && tiles.scrollLeft < max - 4);
  }

  function setupRails() {
    const bodies = document.querySelectorAll('#main-grid .v2-region-body');
    bodies.forEach(body => {
      const tiles = body.querySelector(':scope > .v2-tiles');
      if (!tiles) return;
      let prev = body.querySelector(':scope > .nf-rail-prev');
      let next = body.querySelector(':scope > .nf-rail-next');
      if (!prev) {
        prev = document.createElement('button');
        prev.type = 'button';
        prev.className = 'nf-rail-btn nf-rail-prev';
        prev.setAttribute('aria-label', 'Rolar áreas para a esquerda');
        prev.textContent = '‹';
        prev.addEventListener('click', () => {
          const step = Math.max(244, Math.floor(tiles.clientWidth * 0.78));
          tiles.scrollBy({ left: -step, behavior: 'smooth' });
        });
        body.appendChild(prev);
      }
      if (!next) {
        next = document.createElement('button');
        next.type = 'button';
        next.className = 'nf-rail-btn nf-rail-next';
        next.setAttribute('aria-label', 'Rolar áreas para a direita');
        next.textContent = '›';
        next.addEventListener('click', () => {
          const step = Math.max(244, Math.floor(tiles.clientWidth * 0.78));
          tiles.scrollBy({ left: step, behavior: 'smooth' });
        });
        body.appendChild(next);
      }
      if (!tiles._nfRailBound) {
        tiles._nfRailBound = true;
        tiles.addEventListener('scroll', () => atualizarSetas(body, tiles), { passive: true });
      }
      atualizarSetas(body, tiles);
    });
  }

  /* Transição da barra superior ao rolar (estilo Netflix) */
  let _scrollTick = false;
  window.addEventListener('scroll', () => {
    if (_scrollTick) return;
    _scrollTick = true;
    requestAnimationFrame(() => {
      _scrollTick = false;
      document.body.classList.toggle('nf-scrolled', ligado() && window.scrollY > 12);
    });
  }, { passive: true });
  let _resizeTick = false;
  window.addEventListener('resize', () => {
    if (_resizeTick) return;
    _resizeTick = true;
    requestAnimationFrame(() => {
      _resizeTick = false;
      try { setupRails(); } catch (e) {}
    });
  }, { passive: true });

  /* Engancha sem interferir na renderização original */
  if (typeof renderDashboardV2 === 'function') {
    const _orig = renderDashboardV2;
    renderDashboardV2 = function () {
      const r = _orig.apply(this, arguments);
      try { renderHero(); setupRails(); requestAnimationFrame(() => { try { setupRails(); } catch (e) {} }); } catch (e) { console.warn('netflix hero', e); }
      return r;
    };
  }
  if (typeof toggleV2Tile === 'function') {
    const _tv = toggleV2Tile;
    toggleV2Tile = function () {
      const r = _tv.apply(this, arguments);
      setTimeout(() => { try { setupRails(); } catch (e) {} }, 40);
      return r;
    };
  }
  if (typeof renderInbox === 'function') {
    const _ri = renderInbox;
    renderInbox = function () {
      const r = _ri.apply(this, arguments);
      try { renderHero(); } catch (e) {}
      return r;
    };
  }
  document.addEventListener('sir-recursos', e => {
    if (!e.detail || e.detail.id === 'netflix') {
      document.body.classList.toggle('nf-scrolled', ligado() && window.scrollY > 12);
      try { renderHero(); setupRails(); } catch (err) {}
    }
  });
  document.addEventListener('DOMContentLoaded', () => {
    try { renderHero(); setupRails(); } catch (e) {}
  });
})();
