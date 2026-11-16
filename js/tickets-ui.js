/* ══════════════════════════════════════════════════════════════
   Tela de tickets — complementos do novo visual (v45)
   - Título em duas linhas (título + área)
   - Botão de opções ao lado da busca: abre Ordenar / Filtrar status / CSV
   - Botão "Detalhes" no cartão: abre nota e status do ticket
   - Rodapé com a contagem de tickets (toque: volta ao topo)
   Nada aqui muda dados: só organiza o que já existe na tela.
   ══════════════════════════════════════════════════════════════ */
const LS_TK_OPTS = 'sir_ticket_opts';   // '1' = opções abertas

function _tkContent() { return document.querySelector('#modal-overlay .modal-content'); }

/* Título: "RAL's em tela no CF NO2 - Norte 2 - RJ" → título + subtítulo.
   O texto do elemento continua igual (o nome do CSV usa esse texto). */
function _tkSplitTitle() {
  const el = document.getElementById('modal-title');
  if (!el || el.querySelector('.mt-main')) return;
  const txt = el.textContent, i = txt.indexOf(' - ');
  if (i < 1) return;
  el.textContent = '';
  const mk = (cls, t) => { const s = document.createElement('span'); s.className = cls; s.textContent = t; el.appendChild(s); };
  mk('mt-main', txt.slice(0, i)); mk('mt-sep', ' - '); mk('mt-sub', txt.slice(i + 3));
}

function _tkSetOpts(open) {
  const c = _tkContent(), btn = document.getElementById('btn-tk-opts');
  if (c) c.classList.toggle('tk-opts-open', open);
  if (btn) btn.setAttribute('aria-expanded', String(open));
}

function _tkEnsureOptsBtn() {
  if (document.getElementById('btn-tk-opts')) return;
  const fb = document.getElementById('modal-filter-bar');
  if (!fb) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'btn-tk-opts'; btn.className = 'btn-tk-opts';
  btn.title = 'Opções: ordenar, filtrar status e exportar CSV';
  btn.setAttribute('aria-label', btn.title);
  btn.addEventListener('click', () => {
    const open = !_tkContent().classList.contains('tk-opts-open');
    _tkSetOpts(open);
    try { localStorage.setItem(LS_TK_OPTS, open ? '1' : '0'); } catch (e) {}
    if (open) { const b = document.getElementById('modal-body-scroll'); if (b) b.scrollTop = 0; }
  });
  fb.appendChild(btn);
  let open = false;
  try { open = localStorage.getItem(LS_TK_OPTS) === '1'; } catch (e) {}
  _tkSetOpts(open);
}

/* Detalhes: mostra/esconde nota e status do cartão */
function toggleTicketDetails(btn) {
  const row = btn.closest('tr.ticket-row');
  if (!row) return;
  const open = row.classList.toggle('tk-det-open');
  btn.setAttribute('aria-expanded', String(open));
}

/* Rodapé com a contagem */
function _tkEnsureFoot() {
  let f = document.getElementById('tk-foot');
  if (f) return f;
  const body = document.getElementById('modal-body-scroll');
  if (!body) return null;
  f = document.createElement('button');
  f.type = 'button'; f.id = 'tk-foot'; f.className = 'tk-foot'; f.title = 'Voltar ao início da lista';
  f.innerHTML = '<span id="tk-foot-txt"></span>';
  f.addEventListener('click', () => body.scrollTo({ top: 0, behavior: 'smooth' }));
  body.parentNode.insertBefore(f, body.nextSibling);
  return f;
}

function _tkCount() {
  const tbody = document.getElementById('modal-tbody');
  if (!tbody) return 0;
  /* Lista longa com rolagem virtual: só parte das linhas está na tela */
  if (typeof vtAllRows !== 'undefined' && vtAllRows.length) return vtAllRows.filter(h => h.includes('ticket-row')).length;
  let n = 0;
  tbody.querySelectorAll('tr.ticket-row').forEach(r => { if (r.style.display !== 'none' && !r.hidden) n++; });
  return n;
}

let _tkFootT = null;
function _tkUpdateFoot() {
  clearTimeout(_tkFootT);
  _tkFootT = setTimeout(() => {
    const f = _tkEnsureFoot(); if (!f) return;
    const n = _tkCount();
    document.getElementById('tk-foot-txt').textContent =
      n === 0 ? 'Nenhum ticket encontrado' : `${n} ticket${n === 1 ? '' : 's'} encontrado${n === 1 ? '' : 's'}`;
  }, 60);
}

document.addEventListener('DOMContentLoaded', () => {
  _tkEnsureOptsBtn();
  _tkEnsureFoot();
  /* Disparado por lista-abas.js sempre que a tela de tickets abre ou troca de aba */
  document.addEventListener('sir-list-bar', () => { _tkEnsureOptsBtn(); _tkSplitTitle(); _tkUpdateFoot(); });
  const tbody = document.getElementById('modal-tbody');
  if (tbody && 'MutationObserver' in window) {
    new MutationObserver(_tkUpdateFoot).observe(tbody, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
  }
});
