/* ══════════════════════════════════════════════════════════════
   Loading de reconexão após > 20 min fora + atalho Ctrl+mingau (v96)
   - Exibe assets/reconnect.mp4 (compactado) como tela de loading
     EXCLUSIVAMENTE quando o dashboard restabelece a conexão com o
     servidor após ficar mais de 20 minutos fora / sem resposta.
   - Atalho manual: digitar "Ctrl + mingau" no teclado (segurando
     Ctrl durante a palavra, segurando Ctrl+M e completando "ingau",
     ou tocando Ctrl seguido de "mingau").
   - No celular: adaptado em tela cheia (retrato e paisagem) e
     acessível também digitando "mingau" na Busca rápida.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const VIDEO_SRC    = 'assets/reconnect.mp4';
  const LIMIT_MS     = 20 * 60000;   /* 20 minutos fora */
  const LS_LAST_OK   = 'sir_rc_last_ok';
  const LS_DOWN_AT   = 'sir_rc_down_at';
  const LS_STALE_AT  = 'sir_rc_stale_at';
  const SEQ          = 'mingau';

  let ativo = null;
  let ultimoPlay = 0;

  function lsGetNum(k) {
    try { const n = Number(localStorage.getItem(k)); return Number.isFinite(n) && n > 0 ? n : 0; }
    catch (e) { return 0; }
  }
  function lsSetNum(k, v) {
    try {
      if (v > 0) localStorage.setItem(k, String(v));
      else localStorage.removeItem(k);
    } catch (e) {}
  }

  function fecharOverlay() {
    if (!ativo) return;
    const { ov, vid, timer, onKey } = ativo;
    ativo = null;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    try { vid.pause(); } catch (e) {}
    ov.classList.remove('on');
    ov.classList.add('sai');
    setTimeout(() => { if (ov.isConnected) ov.remove(); }, 380);
  }

  function playReconnectVideo(motivo) {
    if (ativo) return;
    const now = Date.now();
    if (motivo === 'reconnect' && now - ultimoPlay < 15000) return;
    ultimoPlay = now;

    /* Se a entrada padrão ainda estiver na tela, remove para não sobrepor */
    const intro = document.getElementById('sir-intro');
    if (intro) intro.remove();

    const ehAtalho = motivo === 'shortcut';
    const texto = ehAtalho
      ? 'Reprodução via atalho · mingau'
      : 'Conexão restabelecida · Carregando painel...';

    const ov = document.createElement('div');
    ov.id = 'sir-reconnect-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', texto);
    ov.innerHTML = `
      <div class="rc-stage">
        <video class="rc-video" preload="auto" playsinline webkit-playsinline></video>
        <div class="rc-bar-track" aria-hidden="true"><div class="rc-bar-fill"></div></div>
      </div>
      <div class="rc-foot">
        <div class="rc-caption"><span class="rc-dot" aria-hidden="true"></span><span>${texto}</span></div>
        <div class="rc-actions">
          <button type="button" class="rc-btn" data-rc="som" aria-label="Ativar ou silenciar som">Ativar som</button>
          <button type="button" class="rc-btn" data-rc="pular">Pular</button>
        </div>
      </div>`;

    const vid  = ov.querySelector('video');
    const fill = ov.querySelector('.rc-bar-fill');
    const btnSom   = ov.querySelector('[data-rc="som"]');
    const btnPular = ov.querySelector('[data-rc="pular"]');

    vid.src = VIDEO_SRC;
    vid.playsInline = true;
    vid.setAttribute('playsinline', '');
    vid.setAttribute('webkit-playsinline', '');
    /* Reconexão automática começa muda (garante autoplay em iOS/Android/PC);
       no atalho manual tenta com som primeiro e cai para mudo se o navegador bloquear */
    vid.muted = !ehAtalho;

    function syncSom() {
      btnSom.textContent = vid.muted ? 'Ativar som' : 'Silenciar';
      btnSom.setAttribute('aria-pressed', String(!vid.muted));
    }
    syncSom();

    btnSom.addEventListener('click', () => {
      vid.muted = !vid.muted;
      if (vid.paused) vid.play().catch(() => {});
      syncSom();
    });
    btnPular.addEventListener('click', fecharOverlay);

    vid.addEventListener('timeupdate', () => {
      if (vid.duration && Number.isFinite(vid.duration)) {
        fill.style.width = Math.min(100, (vid.currentTime / vid.duration) * 100) + '%';
      }
    });
    vid.addEventListener('ended', fecharOverlay);
    vid.addEventListener('error', fecharOverlay);

    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharOverlay(); }
    };
    document.addEventListener('keydown', onKey, true);

    /* Rede de segurança: nunca deixa o painel travado se o vídeo não encerrar */
    const timer = setTimeout(fecharOverlay, 14000);
    ativo = { ov, vid, timer, onKey };

    (document.body || document.documentElement).appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('on'));

    const iniciar = vid.play();
    if (iniciar && typeof iniciar.catch === 'function') {
      iniciar.catch(() => {
        /* Fallback mudo caso o navegador bloqueie reprodução com áudio */
        vid.muted = true;
        syncSom();
        vid.play().catch(() => fecharOverlay());
      });
    }
  }

  window.playReconnectVideo = playReconnectVideo;

  /* ── 1. Detecção de queda > 20 min e restabelecimento da conexão ── */
  function marcarFora(ts) {
    if (!lsGetNum(LS_DOWN_AT)) {
      const lastOk = lsGetNum(LS_LAST_OK);
      lsSetNum(LS_DOWN_AT, ts || lastOk || Date.now());
    }
  }

  window.addEventListener('offline', () => marcarFora(Date.now()));

  /* Falha de comunicação com o servidor (fallback offline) */
  if (typeof loadFromSnapshot === 'function') {
    const _origSnap = loadFromSnapshot;
    loadFromSnapshot = function () {
      marcarFora(lsGetNum(LS_LAST_OK) || Date.now());
      return _origSnap.apply(this, arguments);
    };
  }

  /* Dados recebidos com sucesso: só dispara se veio rede real (ralText && recText)
     e ficou fora por mais de 20 minutos */
  if (typeof onDataReady === 'function') {
    const _origReady = onDataReady;
    onDataReady = function (ralRes, recRes, ralText, recText, userSavedAreas) {
      const onlineReal = Boolean(ralText && recText);
      const now = Date.now();
      if (onlineReal) {
        const downAt = lsGetNum(LS_DOWN_AT);
        if (downAt && (now - downAt) >= LIMIT_MS) {
          lsSetNum(LS_DOWN_AT, 0);
          lsSetNum(LS_STALE_AT, 0);
          try { playReconnectVideo('reconnect'); } catch (e) { console.warn('reconnect-video', e); }
        } else if (downAt) {
          lsSetNum(LS_DOWN_AT, 0);
        }
        lsSetNum(LS_LAST_OK, now);
      }
      return _origReady.apply(this, arguments);
    };
  }

  /* Também detecta quando os dados do servidor ficaram parados > 20 min e voltaram a atualizar */
  if (typeof setDataSource === 'function') {
    const _origSrc = setDataSource;
    setDataSource = function (src, at) {
      const r = _origSrc.apply(this, arguments);
      try {
        const now = Date.now();
        if (at && at > 0) {
          const idade = now - at;
          const staleAt = lsGetNum(LS_STALE_AT);
          if (idade >= LIMIT_MS) {
            if (!staleAt) lsSetNum(LS_STALE_AT, at);
          } else if (staleAt && (now - staleAt) >= LIMIT_MS) {
            lsSetNum(LS_STALE_AT, 0);
            playReconnectVideo('reconnect');
          } else if (staleAt) {
            lsSetNum(LS_STALE_AT, 0);
          }
        }
      } catch (e) {}
      return r;
    };
  }

  /* ── 2. Atalho de teclado: Ctrl + mingau ──
     Aceita:
       a) segurar Ctrl enquanto digita m-i-n-g-a-u;
       b) apertar Ctrl+M e continuar digitando i-n-g-a-u;
       c) apertar e soltar Ctrl e digitar m-i-n-g-a-u (fora de campos de texto). */
  let pos = 0;
  let seqTimer = null;
  let ctrlArmadoAte = 0;

  function resetSeq() {
    pos = 0;
    clearTimeout(seqTimer);
    seqTimer = null;
  }
  function armarSeq() {
    clearTimeout(seqTimer);
    seqTimer = setTimeout(resetSeq, 4000);
  }
  function emCampoTexto(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  document.addEventListener('keydown', e => {
    if (e.altKey || e.metaKey) { resetSeq(); return; }
    if (e.key === 'Control') {
      if (!e.repeat && !emCampoTexto(e.target)) ctrlArmadoAte = Date.now() + 4000;
      return;
    }
    const k = String(e.key || '').toLowerCase();
    if (k.length !== 1 || k < 'a' || k > 'z') {
      if (pos > 0) resetSeq();
      return;
    }

    const editando = emCampoTexto(e.target);
    const esperado = SEQ[pos];

    if (pos === 0) {
      if (k === esperado && (e.ctrlKey || (!editando && Date.now() <= ctrlArmadoAte))) {
        if (e.ctrlKey) e.preventDefault();
        pos = 1;
        ctrlArmadoAte = 0;
        armarSeq();
      }
      return;
    }

    /* Já no meio da palavra "mingau" */
    if (k === esperado && (e.ctrlKey || !editando)) {
      e.preventDefault();
      e.stopPropagation();
      pos++;
      if (pos >= SEQ.length) {
        resetSeq();
        playReconnectVideo('shortcut');
      } else {
        armarSeq();
      }
    } else if (k === SEQ[0] && e.ctrlKey) {
      e.preventDefault();
      pos = 1;
      armarSeq();
    } else {
      resetSeq();
    }
  }, true);
})();
