/* ══════════════════════════════════════════════════════════════
   Barra inferior no celular (v83)
   Chave: "Barra inferior no celular" (Configurações → Novidades).
   Só aparece em telas de até 640px. Quatro atalhos ao alcance do
   polegar: Painel (volta ao topo), Entradas (abre as novas entradas),
   Buscar (busca rápida) e Torpedos.
   ══════════════════════════════════════════════════════════════ */
(function () {
  const ligado = () => typeof SirRecursos === 'undefined' || SirRecursos.ativo('navcel');
  const ico = {
    painel: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    entradas: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    torpedos: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>'
  };
  const acoes = {
    painel: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    entradas: () => {
      if (typeof setInboxBodyVisible === 'function') setInboxBodyVisible(true);
      const s = document.getElementById('inbox-section'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    buscar: () => { if (typeof SirComando !== 'undefined') SirComando.abre(); },
    torpedos: () => { if (typeof openTorpedos === 'function') openTorpedos(); }
  };
  function monta() {
    let nav = document.getElementById('nav-celular');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'nav-celular'; nav.className = 'nav-celular'; nav.setAttribute('aria-label', 'Atalhos');
      nav.innerHTML = [['painel', 'Painel'], ['entradas', 'Entradas'], ['buscar', 'Buscar'], ['torpedos', 'Torpedos']].map(([k, t]) =>
        `<button type="button" data-nav="${k}"${k === 'painel' ? ' class="on"' : ''}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico[k]}</svg>
          <span>${t}</span></button>`).join('');
      nav.addEventListener('click', e => {
        const b = e.target.closest('[data-nav]'); if (!b) return;
        if (b.dataset.nav === 'painel' || b.dataset.nav === 'entradas') nav.querySelectorAll('[data-nav]').forEach(x => x.classList.toggle('on', x === b));
        acoes[b.dataset.nav]();
      });
      document.body.appendChild(nav);
    }
    const busca = nav.querySelector('[data-nav="buscar"]');
    if (busca) busca.hidden = typeof SirRecursos !== 'undefined' && !SirRecursos.ativo('comando');
    nav.hidden = !ligado();
  }
  document.addEventListener('DOMContentLoaded', monta);
  document.addEventListener('sir-recursos', monta);
})();
