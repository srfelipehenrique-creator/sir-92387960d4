/* ── Menu lateral (☰) ──
   Todos os botões de ferramentas (Torpedos, Máscaras, Qualidade, Textos,
   Histórico, Siglas, Endereços, Timer, Minhas Áreas, Lixeira, Alimentar
   off-line) ficam dentro do menu. Os botões são os mesmos de antes — só
   mudaram de lugar — então cada um continua com a sua função. */
function openAppMenu() {
  const m = document.getElementById('app-menu');
  if (!m) return;
  m.removeAttribute('inert');
  m.setAttribute('aria-hidden', 'false');
  document.body.classList.add('app-menu-open');
  document.getElementById('btn-app-menu')?.setAttribute('aria-expanded', 'true');
  setTimeout(() => m.querySelector('.app-menu-close')?.focus({ preventScroll: true }), 50);
}
function closeAppMenu() {
  const m = document.getElementById('app-menu');
  if (!m || !document.body.classList.contains('app-menu-open')) return;
  document.body.classList.remove('app-menu-open');
  m.setAttribute('aria-hidden', 'true');
  m.setAttribute('inert', '');
  const b = document.getElementById('btn-app-menu');
  b?.setAttribute('aria-expanded', 'false');
}
function toggleAppMenu() {
  document.body.classList.contains('app-menu-open') ? closeAppMenu() : openAppMenu();
}

function toggleSirSubmenu(btn) {
  const sub = document.getElementById('menu-sir-sub');
  if (!sub || !btn) return;
  const open = sub.hidden;
  sub.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
  btn.classList.toggle('is-open', open);
}

document.addEventListener('DOMContentLoaded', () => {
  const body = document.querySelector('#app-menu .app-menu-body');
  /* Tocou numa ferramenta: ela abre e o menu fecha (exceto toggles de submenu) */
  body?.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.hasAttribute('data-menu-keep-open')) return;
    closeAppMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAppMenu(); });
  if (typeof lucide !== 'undefined')
    lucide.createIcons({ nodes: Array.from(document.querySelectorAll('header [data-lucide], #app-menu [data-lucide]')) });
});
