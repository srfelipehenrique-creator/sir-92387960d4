/* ══════════════════════════════════════════════════════════════
   v104 — Sessão e níveis de acesso no painel
   - A porta de entrada (index.html) manda para pages/login.html quem não
     tem sessão válida. Aqui: confere a sessão no servidor a cada 10 min,
     marca o nível na página (html[data-papel]) e esconde o que o nível
     não pode usar. Quem decide de verdade é o servidor.
   - O token da sessão passa a ser a "chave" das rotas do servidor
     (dados, notas, endereços…), com o nível de quem entrou.
   - Menu: nome e nível de quem entrou, "Usuários" (Gestor para cima) e "Sair".
   ══════════════════════════════════════════════════════════════ */

const LS_SESS = 'sir_sess_v1';
const SIR_NIVEIS = { dev: 'Desenvolvedor', gerencia: 'Gerência', gestor: 'Gestor', apoio: 'Apoio técnico' };

function sirSessao() {
  try { const s = JSON.parse(localStorage.getItem(LS_SESS) || 'null'); return s && s.token && s.expira > Date.now() ? s : null; } catch (e) { return null; }
}
function sirUsuario() { const s = sirSessao(); return s ? s.usuario : null; }
function sirNivel() { const u = sirUsuario(); return u ? u.nivel : ''; }
function sirPode(acao) {
  const n = sirNivel();
  const regras = {
    inserirManual: ['dev', 'gerencia', 'gestor'],
    usuarios:      ['dev', 'gerencia', 'gestor'],
    tecnico:       ['dev'],                 /* coletor, servidor, chaves, versões */
    editarNotaOutro: ['dev', 'gerencia'],
    telefones:     ['dev', 'gerencia', 'gestor'],
  };
  return !!(regras[acao] && regras[acao].includes(n));
}

function sirSair(motivo) {
  const s = sirSessao();
  if (s && typeof SIR_PUSH_URL === 'string') {
    try { fetch(SIR_PUSH_URL.replace(/\/+$/, '') + '/auth/sair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token }), keepalive: true }); } catch (e) {}
  }
  try { localStorage.removeItem(LS_SESS); } catch (e) {}
  location.replace('pages/login.html?sair=1' + (motivo ? '&motivo=' + encodeURIComponent(motivo) : ''));
}

/* Confere no servidor se a sessão continua valendo (bloqueio, troca de nível, saída) */
async function sirConferirSessao() {
  const s = sirSessao();
  if (!s) return sirSair('expirou');
  if (!navigator.onLine || typeof SIR_PUSH_URL !== 'string') return;
  try {
    const r = await fetch(SIR_PUSH_URL.replace(/\/+$/, '') + '/auth/eu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token }) });
    if (r.status === 401) return sirSair('expirou');
    if (r.ok) {
      const j = await r.json();
      if (j.usuario) {
        const mudou = j.usuario.nivel !== s.usuario.nivel;
        s.usuario = j.usuario;
        try { localStorage.setItem(LS_SESS, JSON.stringify(s)); } catch (e) {}
        sirAplicarNivel();
        if (mudou && typeof showActionToast === 'function') showActionToast(`Seu nível de acesso agora é ${SIR_NIVEIS[j.usuario.nivel]}`, 'info');
      }
    }
  } catch (e) {}
}

function sirAplicarNivel() {
  const u = sirUsuario();
  document.documentElement.dataset.papel = u ? u.nivel : '';
  _sirMenuConta();
}

function _sirMenuConta() {
  const body = document.querySelector('#app-menu .app-menu-body');
  if (!body) return;
  let box = document.getElementById('menu-conta');
  if (!box) {
    box = document.createElement('div');
    box.id = 'menu-conta'; box.className = 'menu-layout menu-conta';
    body.appendChild(box);
  }
  const u = sirUsuario();
  if (!u) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="menu-conta-id" title="${escapeHtml(u.email)}">
      <span class="menu-conta-nome">${escapeHtml(u.nome)}</span>
      <span class="menu-conta-nivel nivel-${escapeHtml(u.nivel)}">${escapeHtml(SIR_NIVEIS[u.nivel] || u.nivel)}</span>
    </div>
    ${sirPode('usuarios') ? `<button type="button" class="menu-layout-opt" onclick="closeAppMenu(); abrirUsuarios();"><i data-lucide="users"></i><span>Usuários e acessos</span></button>` : ''}
    <button type="button" class="menu-layout-opt" onclick="sirSair()"><i data-lucide="log-out"></i><span>Sair</span></button>`;
  if (typeof lucide !== 'undefined') lucide.createIcons({ nodes: Array.from(box.querySelectorAll('[data-lucide]')) });
}

/* O token da sessão vale como chave nas rotas do servidor */
if (typeof _pushKey === 'function') {
  const _chaveAntiga = _pushKey;
  _pushKey = function () { const s = sirSessao(); return s ? s.token : _chaveAntiga(); };   /* eslint-disable-line no-global-assign */
}
/* Desenvolvedor e Gerência podem editar/excluir nota de outra pessoa (o servidor confere) */
if (typeof canManageNote === 'function') {
  const _cmn = canManageNote;
  canManageNote = function (n) { return sirPode('editarNotaOutro') || _cmn(n); };   /* eslint-disable-line no-global-assign */
}

document.addEventListener('DOMContentLoaded', () => {
  const u = sirUsuario();
  if (u) { try { localStorage.setItem('sir_user_name', u.nome); } catch (e) {} }
  sirAplicarNivel();
  /* Coletor, servidor e chaves: só o Desenvolvedor */
  if (typeof openColetor === 'function') {
    const _oc = openColetor;
    openColetor = function () { if (!sirPode('tecnico')) { if (typeof showActionToast === 'function') showActionToast('Só o Desenvolvedor configura o coletor', 'error'); return; } return _oc.apply(this, arguments); };   /* eslint-disable-line no-global-assign */
  }
  sirConferirSessao();
  setInterval(sirConferirSessao, 10 * 60000);
  /* Sessão vence no fim do turno (12 h): volta para o login */
  const s = sirSessao();
  if (s) setTimeout(() => sirSair('expirou'), Math.max(0, s.expira - Date.now()) + 1000);
});
