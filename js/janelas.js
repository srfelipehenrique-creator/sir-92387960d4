/* ══════════════════════════════════════════════════════════════
   Acessibilidade das janelas e botões (v83) — correção, sem chave
   - Toda janela (.modal-overlay) vira um diálogo de verdade: ao abrir,
     o foco vai para dentro dela e o Tab fica preso nela; ao fechar,
     o foco volta para o botão que a abriu.
   - Botões só com símbolo (×, ▲, ▼, ⎘) ganham nome para o leitor de tela.
   - Buscas com só "placeholder" ganham nome.
   - Avisos que aparecem sozinhos (toasts) passam a ser lidos.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const visiveis = box => [...box.querySelectorAll(FOCAVEIS)].filter(el => el.offsetParent !== null || el === document.activeElement);
  const origem = new WeakMap();
  let n = 0;

  function prepara(ov) {
    const box = ov.querySelector('.modal-content') || ov;
    if (box.getAttribute('role') !== 'dialog') {
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      const t = box.querySelector('.modal-title');
      if (t) { if (!t.id) t.id = 'jan-tit-' + (++n); box.setAttribute('aria-labelledby', t.id); }
    }
    return box;
  }
  function abriu(ov) {
    const box = prepara(ov);
    const ae = document.activeElement;
    if (ae && !box.contains(ae)) origem.set(ov, ae);
    setTimeout(() => {   /* espera a janela aparecer */
      if (box.contains(document.activeElement)) return;
      const alvo = box.querySelector('[autofocus]') || box.querySelector('input:not([type="hidden"]), textarea') || box.querySelector('.modal-close-btn') || visiveis(box)[0];
      if (alvo) try { alvo.focus({ preventScroll: true }); } catch (e) {}
    }, 60);
  }
  function fechou(ov) {
    const o = origem.get(ov);
    origem.delete(ov);
    if (o && document.contains(o) && !document.querySelector('.modal-overlay.active')) try { o.focus({ preventScroll: true }); } catch (e) {}
  }

  const obs = new MutationObserver(lista => {
    for (const m of lista) {
      const ov = m.target;
      if (!ov.classList || !ov.classList.contains('modal-overlay')) continue;
      const ativo = ov.classList.contains('active'), era = (m.oldValue || '').split(/\s+/).includes('active');
      if (ativo && !era) abriu(ov);
      else if (!ativo && era) fechou(ov);
    }
  });

  /* Tab preso na janela aberta mais acima */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.defaultPrevented) return;
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('.cmd-overlay')) return;   /* a busca rápida cuida do próprio foco */
    const abertas = [...document.querySelectorAll('.modal-overlay.active')];
    if (!abertas.length) return;
    const box = prepara(abertas[abertas.length - 1]);
    const f = visiveis(box);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (!box.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
    else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });

  /* Nomes para botões só com símbolo e campos só com placeholder */
  const NOMES = { '×': 'Fechar', '✕': 'Fechar', '⎘': 'Copiar', '···': 'Mais opções', '+': 'Adicionar' };
  function nomeia(raiz) {
    raiz.querySelectorAll('button:not([aria-label])').forEach(b => {
      const t = b.textContent.trim();
      if (NOMES[t]) b.setAttribute('aria-label', NOMES[t]);
      else if (t === '▲' || t === '▼') {
        const a = (b.getAttribute('onclick') || '').match(/adjustCountdown\((-?\d+)\)/);
        if (a) { const v = +a[1]; b.setAttribute('aria-label', `${v > 0 ? 'Mais' : 'Menos'} ${Math.abs(v) >= 60 ? '1 minuto' : '1 segundo'}`); }
      } else if (!t && b.title) b.setAttribute('aria-label', b.title);
    });
    raiz.querySelectorAll('input[placeholder]:not([aria-label]):not([id]), input[placeholder][id]:not([aria-label])').forEach(i => {
      if (i.id && document.querySelector(`label[for="${i.id}"]`)) return;
      i.setAttribute('aria-label', i.placeholder.replace(/\.\.\.$/, '').replace(/\n.*/s, ''));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-overlay').forEach(ov => { prepara(ov); obs.observe(ov, { attributes: true, attributeFilter: ['class'], attributeOldValue: true }); });
    nomeia(document);
    new MutationObserver(l => l.forEach(m => m.addedNodes.forEach(nd => { if (nd.nodeType === 1) nomeia(nd); })))
      .observe(document.body, { childList: true, subtree: true });
    const t = document.getElementById('action-toasts');
    if (t) { t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); }
    const w = document.getElementById('warning-toast');
    if (w) w.setAttribute('role', 'status');
  });
})();
