/* ── Módulos Fixados ── permite fixar ferramentas como módulos na tela principal ── */

const LS_PINNED     = 'sir_pinned_modules';
const LS_COLLAPSED  = 'sir_pinned_collapsed';

/* Ferramentas que podem ser fixadas (modalId → metadados) */
const PINNABLE = {
  'torpedo-modal': {
    label: 'Torpedos', icon: 'megaphone',
    openFn: 'openTorpedos', closeFn: 'closeTorpedos',
    onPin() {
      if (typeof renderizarListaTorpedos === 'function') renderizarListaTorpedos();
      if (typeof idTorpedoAtivo !== 'undefined' && idTorpedoAtivo)
        if (typeof carregarDadosTorpedo === 'function') carregarDadosTorpedo();
    }
  },
  'mascaras-modal': {
    label: 'Máscaras', icon: 'bot',
    openFn: 'openMascaras', closeFn: 'closeMascaras',
    onPin() {
      const nome = localStorage.getItem('usuario_nome_bw') || '';
      const el = document.getElementById('m_userName');
      if (el) el.value = nome;
      if (typeof atualizarPreviewMascara === 'function') atualizarPreviewMascara();
      if (typeof atualizarChipsMascara === 'function') atualizarChipsMascara();
      /* Inicia o timer de preview se não estiver rodando */
      if (!mascaraPreviewTimer)
        mascaraPreviewTimer = setInterval(atualizarPreviewMascara, 1000);
    },
    onUnpin() {
      /* Para o timer ao desafixar para que openMascaras possa reiniciá-lo limpo */
      if (typeof mascaraPreviewTimer !== 'undefined' && mascaraPreviewTimer) {
        clearInterval(mascaraPreviewTimer);
        mascaraPreviewTimer = null;
      }
    }
  },
  'scripts-modal': {
    label: 'Textos Prontos', icon: 'pen-line',
    openFn: 'openScripts', closeFn: 'closeScripts',
    onPin() { if (typeof renderScriptsGrid === 'function') renderScriptsGrid(); }
  },
  'historico-modal': {
    label: 'Histórico', icon: 'archive',
    openFn: 'openHistorico', closeFn: 'closeHistorico',
    onPin() { if (typeof renderHistoricoList === 'function') renderHistoricoList(); }
  },
  'siglas-modal': {
    label: 'Siglas', icon: 'book-open',
    openFn: 'openSiglas', closeFn: 'closeSiglas',
    onPin() {
      /* Carrega o iframe se ainda não foi carregado */
      if (typeof siglasLoaded !== 'undefined' && !siglasLoaded) {
        const iframe = document.getElementById('siglas-iframe');
        if (iframe) iframe.src = 'tools/buscador_siglas.html';
        siglasLoaded = true;
      }
    }
  },
};

/* Referências às funções de fechar originais (antes do wrap) */
const _origClose = {};

/* ── Storage ── */
function getPinnedList() {
  try { return JSON.parse(localStorage.getItem(LS_PINNED) || '[]'); }
  catch { return []; }
}
function savePinnedList(list) { localStorage.setItem(LS_PINNED, JSON.stringify(list)); }
function isPinned(modalId)    { return getPinnedList().includes(modalId); }

function getCollapsedList() {
  try { return JSON.parse(localStorage.getItem(LS_COLLAPSED) || '[]'); }
  catch { return []; }
}
function saveCollapsedList(list) { localStorage.setItem(LS_COLLAPSED, JSON.stringify(list)); }

/* ── Fixar ── */
function pinModule(modalId) {
  if (isPinned(modalId)) { scrollToPinned(modalId); return; }

  /* Fecha o popup usando a função original (salva estado, remove active) */
  if (typeof _origClose[modalId] === 'function') _origClose[modalId]();
  else document.getElementById(modalId)?.classList.remove('active');

  const list = getPinnedList();
  list.push(modalId);
  savePinnedList(list);

  _mountModule(modalId);
  _updateAllPinBtns();
}

/* ── Desafixar ── */
function unpinModule(modalId) {
  /* Callback específico antes de desafixar (ex: para o timer de máscaras) */
  PINNABLE[modalId]?.onUnpin?.();

  savePinnedList(getPinnedList().filter(id => id !== modalId));
  _unmountModule(modalId);
  _updateAllPinBtns();

  if (typeof showActionToast === 'function')
    showActionToast(`${PINNABLE[modalId]?.label || 'Módulo'} voltou para popup`, 'info');
}

/* ── Montar módulo na tela ── */
function _mountModule(modalId, isRestore = false) {
  const tool = PINNABLE[modalId];
  if (!tool) return;

  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  const content = overlay.querySelector('.modal-content');
  if (!content) return;

  const area = document.getElementById('pinned-modules-area');
  if (!area) return;

  /* Wrapper do módulo fixado */
  const wrapper = document.createElement('section');
  wrapper.className = 'pinned-module';
  wrapper.id = `pinned-${modalId}`;
  wrapper.innerHTML = `
    <div class="pinned-mod-hd" onclick="togglePinnedCollapse('${modalId}')" title="Clique para minimizar / expandir">
      <div class="pinned-mod-title">
        <i data-lucide="${tool.icon}" class="pinned-mod-icon"></i>
        <span>${tool.label}</span>
        <span class="pinned-mod-badge">Fixado</span>
      </div>
      <div class="pinned-mod-acts">
        <i data-lucide="chevron-up" class="pinned-chevron"></i>
        <button class="pinned-btn pinned-btn-unpin"
                onclick="unpinModule('${modalId}'); event.stopPropagation();"
                title="Desafixar — retorna para popup">
          <i data-lucide="pin-off"></i>
          Desafixar
        </button>
      </div>
    </div>
    <div class="pinned-mod-body" id="pinned-body-${modalId}"></div>
  `;
  area.appendChild(wrapper);

  /* Restaura estado colapsado da sessão anterior */
  if (getCollapsedList().includes(modalId)) {
    wrapper.classList.add('pinned-collapsed');
  }

  /* Move o conteúdo do modal para dentro do wrapper */
  content.classList.add('pinned-content');
  document.getElementById(`pinned-body-${modalId}`).appendChild(content);

  if (typeof lucide !== 'undefined')
    lucide.createIcons({ nodes: Array.from(wrapper.querySelectorAll('[data-lucide]')) });

  /* Inicializa o conteúdo da ferramenta */
  tool.onPin?.();

  /* Ao abrir o app (restauração), não rola a página nem mostra aviso:
     só quando você fixa um módulo agora */
  if (isRestore) return;

  /* Scrolla até o novo módulo */
  setTimeout(() => wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

  if (typeof showActionToast === 'function')
    showActionToast(`${tool.label} fixado na tela`, 'success');
}

/* ── Desmontar módulo ── */
function _unmountModule(modalId) {
  const wrapper = document.getElementById(`pinned-${modalId}`);
  const overlay = document.getElementById(modalId);
  if (!wrapper || !overlay) return;

  /* Devolve o conteúdo para o modal overlay */
  const content = wrapper.querySelector('.modal-content');
  if (content) {
    content.classList.remove('pinned-content');
    overlay.appendChild(content);
  }

  /* Limpa o estado colapsado salvo */
  saveCollapsedList(getCollapsedList().filter(id => id !== modalId));

  wrapper.remove();
}

/* ── Colapsar / Expandir ── */
function togglePinnedCollapse(modalId) {
  const wrapper = document.getElementById(`pinned-${modalId}`);
  if (!wrapper) return;
  const collapsed = wrapper.classList.toggle('pinned-collapsed');

  /* Persiste o estado colapsado */
  const list = getCollapsedList();
  if (collapsed) {
    if (!list.includes(modalId)) list.push(modalId);
  } else {
    const idx = list.indexOf(modalId);
    if (idx > -1) list.splice(idx, 1);
  }
  saveCollapsedList(list);
}

/* ── Scroll + Highlight ── */
function scrollToPinned(modalId) {
  const wrapper = document.getElementById(`pinned-${modalId}`);
  if (!wrapper) return;
  if (wrapper.classList.contains('pinned-collapsed')) togglePinnedCollapse(modalId);
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  wrapper.classList.add('pinned-highlight');
  setTimeout(() => wrapper.classList.remove('pinned-highlight'), 900);
}

/* ── Atualiza botões de pin nos modais ── */
function _updateAllPinBtns() {
  document.querySelectorAll('[data-pin-modal]').forEach(btn => {
    const modalId = btn.dataset.pinModal;
    const pinned  = isPinned(modalId);
    btn.classList.toggle('btn-pin-active', pinned);
    btn.title = pinned ? 'Já fixado — clique para ir até o módulo' : 'Fixar na tela principal';
    const icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', pinned ? 'check-circle' : 'pin');
      if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: [icon] });
    }
  });
}

/* ── Intercepta as funções open/close para redirecionar quando fixado ── */
function _wrapFns() {
  Object.entries(PINNABLE).forEach(([modalId, tool]) => {
    /* open → scrolla para o módulo se fixado */
    const origOpen = window[tool.openFn];
    if (typeof origOpen === 'function') {
      window[tool.openFn] = function(...args) {
        if (isPinned(modalId)) { scrollToPinned(modalId); return; }
        origOpen.apply(this, args);
      };
    }

    /* close → no-op se o módulo estiver fixado (evita fechar o conteúdo que está na tela) */
    const origClose = window[tool.closeFn];
    if (typeof origClose === 'function') {
      _origClose[modalId] = origClose;
      window[tool.closeFn] = function(...args) {
        if (isPinned(modalId)) return;
        origClose.apply(this, args);
      };
    }
  });
}

/* ── API pública — chamada por app.js ── */

/* Inicializa wraps e estado visual dos botões (deve rodar antes do usuário interagir) */
function initPinnedSystem() {
  _wrapFns();
  _updateAllPinBtns();
}

/* Restaura módulos fixados na sessão anterior (deve rodar após initHistorico resolver) */
function restorePinnedModules() {
  getPinnedList().forEach(id => _mountModule(id, true));
}
