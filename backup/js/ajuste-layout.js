/* ══════════════════════════════════════════════════════════════
   Modo Ajuste Manual (temporário · v111)
   Torna todos os blocos e cards do dashboard redimensionáveis e
   arrastáveis manualmente, salvando as medidas em localStorage e
   permitindo resetar ou copiar as medidas finais.
   ══════════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const LS_STATE = 'sir_ajuste_manual_v1';
  const LS_ON    = 'sir_ajuste_manual_on_v1';

  let enabled = true;
  try {
    const s = localStorage.getItem(LS_ON);
    if (s === '0') enabled = false;
  } catch (e) {}

  let layoutMap = {};
  try {
    layoutMap = JSON.parse(localStorage.getItem(LS_STATE) || '{}') || {};
  } catch (e) { layoutMap = {}; }

  function saveState() {
    try { localStorage.setItem(LS_STATE, JSON.stringify(layoutMap)); } catch (e) {}
  }
  function saveOn() {
    try { localStorage.setItem(LS_ON, enabled ? '1' : '0'); } catch (e) {}
  }

  let hudEl = null;
  function getHud() {
    if (hudEl) return hudEl;
    hudEl = document.createElement('div');
    hudEl.className = 'aj-live-hud';
    hudEl.hidden = true;
    document.body.appendChild(hudEl);
    return hudEl;
  }
  function showHud(text, x, y) {
    const h = getHud();
    h.textContent = text;
    h.hidden = false;
    h.style.left = Math.min(window.innerWidth - 180, Math.max(8, x + 14)) + 'px';
    h.style.top  = Math.min(window.innerHeight - 40, Math.max(8, y - 34)) + 'px';
  }
  function hideHud() {
    if (hudEl) hudEl.hidden = true;
  }

  function applySavedToEl(el, key) {
    const d = layoutMap[key];
    if (!d) {
      el.removeAttribute('data-aj-sized');
      el.style.removeProperty('width');
      el.style.removeProperty('height');
      el.style.removeProperty('translate');
      return;
    }
    if (d.w || d.h) {
      el.setAttribute('data-aj-sized', '1');
      if (d.w) el.style.width = d.w + 'px';
      if (d.h) el.style.height = d.h + 'px';
    }
    if (d.x || d.y) {
      el.style.translate = `${d.x || 0}px ${d.y || 0}px`;
    }
  }

  function decorate(el, key, label) {
    if (!el) return;
    el.setAttribute('data-aj-key', key);
    applySavedToEl(el, key);

    if (!el.querySelector(':scope > .aj-drag-handle')) {
      const dh = document.createElement('button');
      dh.type = 'button';
      dh.className = 'aj-drag-handle';
      dh.title = `Arrastar ${label} (duplo clique reseta posição)`;
      dh.setAttribute('aria-label', `Mover ${label}`);
      dh.textContent = `⋮⋮ ${label}`;
      dh.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
      dh.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        if (layoutMap[key]) {
          delete layoutMap[key].x; delete layoutMap[key].y;
          if (!layoutMap[key].w && !layoutMap[key].h) delete layoutMap[key];
          saveState();
          applySavedToEl(el, key);
        }
      });
      dh.addEventListener('pointerdown', e => startDrag(e, el, key, dh));
      el.appendChild(dh);
    }

    if (!el.querySelector(':scope > .aj-resize-handle')) {
      const rh = document.createElement('button');
      rh.type = 'button';
      rh.className = 'aj-resize-handle';
      rh.title = `Redimensionar ${label} (duplo clique reseta tamanho)`;
      rh.setAttribute('aria-label', `Redimensionar ${label}`);
      rh.textContent = '⤢';
      rh.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
      rh.addEventListener('dblclick', e => {
        e.preventDefault(); e.stopPropagation();
        if (layoutMap[key]) {
          delete layoutMap[key].w; delete layoutMap[key].h;
          if (!layoutMap[key].x && !layoutMap[key].y) delete layoutMap[key];
          saveState();
          applySavedToEl(el, key);
        }
      });
      rh.addEventListener('pointerdown', e => startResize(e, el, key, rh));
      el.appendChild(rh);
    }
  }

  function startDrag(e, el, key, handle) {
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    handle.setPointerCapture?.(e.pointerId);
    el.classList.add('aj-active');
    const cur = layoutMap[key] || {};
    const startX = e.clientX, startY = e.clientY;
    const baseX = cur.x || 0, baseY = cur.y || 0;

    const onMove = ev => {
      const nx = Math.round(baseX + (ev.clientX - startX));
      const ny = Math.round(baseY + (ev.clientY - startY));
      layoutMap[key] = { ...(layoutMap[key] || {}), x: nx, y: ny };
      el.style.translate = `${nx}px ${ny}px`;
      showHud(`X:${nx}  Y:${ny}`, ev.clientX, ev.clientY);
    };
    const onUp = () => {
      el.classList.remove('aj-active');
      hideHud();
      saveState();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function startResize(e, el, key, handle) {
    if (!enabled) return;
    e.preventDefault(); e.stopPropagation();
    handle.setPointerCapture?.(e.pointerId);
    el.classList.add('aj-active');
    const rect = el.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    const baseW = Math.round(rect.width), baseH = Math.round(rect.height);

    const onMove = ev => {
      const nw = Math.max(120, Math.round(baseW + (ev.clientX - startX)));
      const nh = Math.max(64,  Math.round(baseH + (ev.clientY - startY)));
      layoutMap[key] = { ...(layoutMap[key] || {}), w: nw, h: nh };
      el.setAttribute('data-aj-sized', '1');
      el.style.width = nw + 'px';
      el.style.height = nh + 'px';
      showHud(`${nw} × ${nh} px`, ev.clientX, ev.clientY);
    };
    const onUp = () => {
      el.classList.remove('aj-active');
      hideHud();
      saveState();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function scanAndAttach() {
    decorate(document.getElementById('nf-hero'), 'hero', 'Banner');
    decorate(document.getElementById('inbox-section'), 'inbox', 'Novas Entradas');
    decorate(document.getElementById('pinned-modules-area'), 'pinned', 'Fixados');

    document.querySelectorAll('#main-grid .v2-kpi, #main-grid .v2-total-card').forEach((el, i) => {
      const tit = (el.querySelector('.v2-kpi-lbl, .v2-total-title, h3, b')?.textContent || '').trim().slice(0, 14) || `Total ${i + 1}`;
      decorate(el, `kpi:${i}`, tit);
    });

    document.querySelectorAll('#main-grid .v2-region').forEach((reg, i) => {
      const nm = (reg.querySelector('.v2-region-name, .v2-region-title, h3')?.textContent || `Grupo ${i + 1}`).trim().slice(0, 16);
      decorate(reg, `reg:${nm}`, nm);
    });

    document.querySelectorAll('#main-grid .v2-tile').forEach((tile, i) => {
      const cf = tile.dataset.cf || (tile.querySelector('.v2-cf-code, .v2-tile-cf, strong, b')?.textContent || `Card ${i + 1}`).trim().slice(0, 10);
      decorate(tile, `cf:${cf}`, cf);
    });
  }

  function syncBodyClass() {
    document.body.classList.toggle('sir-ajuste-on', enabled);
    const btn = document.getElementById('aj-btn-toggle');
    if (btn) {
      btn.classList.toggle('on', enabled);
      btn.textContent = enabled ? '✋ Ajuste Manual: ON' : '✋ Ajuste Manual: OFF';
      btn.setAttribute('aria-pressed', String(enabled));
    }
  }

  function buildToolbar() {
    if (document.getElementById('aj-toolbar')) return;
    const bar = document.createElement('div');
    bar.id = 'aj-toolbar';
    bar.className = 'aj-toolbar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Controles de ajuste manual do layout');
    bar.innerHTML = `
      <button type="button" class="aj-tb-btn" id="aj-btn-toggle" title="Ligar/desligar modo de ajuste manual">✋ Ajuste Manual: ON</button>
      <button type="button" class="aj-tb-btn" id="aj-btn-copy" title="Copiar medidas ajustadas para aplicar definitivamente">📋 Copiar medidas</button>
      <button type="button" class="aj-tb-btn danger" id="aj-btn-reset" title="Resetar todos os tamanhos e posições">↺ Resetar</button>
    `;
    document.body.appendChild(bar);

    bar.querySelector('#aj-btn-toggle').addEventListener('click', () => {
      enabled = !enabled;
      saveOn();
      syncBodyClass();
      if (enabled) scanAndAttach();
    });

    bar.querySelector('#aj-btn-reset').addEventListener('click', () => {
      layoutMap = {};
      saveState();
      document.querySelectorAll('[data-aj-key]').forEach(el => applySavedToEl(el, el.getAttribute('data-aj-key')));
      if (typeof showActionToast === 'function') showActionToast('Layout manual resetado para o padrão');
    });

    bar.querySelector('#aj-btn-copy').addEventListener('click', () => {
      const keys = Object.keys(layoutMap);
      if (!keys.length) {
        if (typeof showActionToast === 'function') showActionToast('Nenhum bloco ajustado ainda');
        return;
      }
      const txt = JSON.stringify({ viewport: { w: window.innerWidth, h: window.innerHeight }, blocos: layoutMap }, null, 2);
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(txt).then(() => {
          if (typeof showActionToast === 'function') showActionToast(`Medidas de ${keys.length} bloco(s) copiadas!`);
        });
      }
    });

    syncBodyClass();
  }

  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scanAndAttach();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildToolbar();
    scanAndAttach();
    const shell = document.querySelector('.page-shell');
    if (shell && 'MutationObserver' in window) {
      new MutationObserver(scheduleScan).observe(shell, { childList: true, subtree: true });
    }
  });
  window.addEventListener('sir:data-ready', scheduleScan);
})();
